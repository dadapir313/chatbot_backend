import { prisma } from '../lib/prisma.js';
import { getAIResponse } from '../lib/llm.js';
import { HumanMessage, AIMessage } from "@langchain/core/messages";


const saveChatMessage = async (conversationId, sender, content) => {
    return prisma.message.create({
        data: { conversationId, sender, content }
    });
};

// Helper function for fast path greeting
const isGreeting = (text) => {
    const lowerText = text.toLowerCase().trim();
    return ["hi", "hello", "hey", "good morning", "good afternoon", "good evening"].some(g => lowerText.startsWith(g));
};

export const sendMessage = async (req, res) => {
    const { content, conversationId } = req.body;
    const userId = req.user.userId;
    const startTime = Date.now();
    console.log(`>>> [REQUEST RECEIVED] user=${userId}, content="${content?.substring(0, 20)}..."`);
    try {
        if (!content) {
            return res.status(400).json({ error: "Message content is required" });
        }

        // ⚡ Fast Path: Greetings
        if (isGreeting(content)) { // Changed 'input' to 'content'
            console.log(">>> [FAST PATH] Greeting detected. Jumping to instant response.");
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Transfer-Encoding', 'chunked');
            res.setHeader('x-conversation-id', conversationId || 'new'); // Placeholder for new conversation
            res.setHeader('Access-Control-Expose-Headers', 'x-conversation-id');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');

            const greetingResponse = "Hello! I am Dr. Nura AI, your professional healthcare assistant. How can I help you with your health today?";
            res.write(greetingResponse);
            res.end();
            // If it's a new conversation, we should still create it and save the messages.
            // This part needs to be handled carefully if we want to save the greeting.
            // For now, we'll assume the fast path doesn't save to DB immediately.
            // If conversationId is not present, a new one should be created.
            if (!conversationId) {
                const newConversation = await prisma.conversation.create({
                    data: {
                        userId,
                        title: content.substring(0, 30) + (content.length > 30 ? "..." : ""),
                    }
                });
                saveChatMessage(newConversation.id, "user", content).catch(err => console.error("BG Save Error:", err));
                saveChatMessage(newConversation.id, "ai", greetingResponse).catch(err => console.error("BG Save Error:", err));
                res.setHeader('x-conversation-id', newConversation.id); // Update header with actual ID
            } else {
                saveChatMessage(conversationId, "user", content).catch(err => console.error("BG Save Error:", err));
                saveChatMessage(conversationId, "ai", greetingResponse).catch(err => console.error("BG Save Error:", err));
            }
            return;
        }

        let conversation;
        let chatHistory = [];

        // 1. Handle Conversation & Fetch History
        if (conversationId) {
            conversation = await prisma.conversation.findUnique({
                where: { id: conversationId }
            });

            if (!conversation || conversation.userId !== userId) {
                return res.status(404).json({ error: "Conversation not found" });
            }

            const historyMessages = await prisma.message.findMany({
                where: { conversationId },
                orderBy: { createdAt: 'asc' },
                take: -5 // Fetch only last 5 messages for context. Reduced from 7 to improve performance.
            });

            chatHistory = historyMessages.map(msg =>
                msg.sender === "user" ? new HumanMessage(msg.content) : new AIMessage(msg.content)
            );
        } else {
            conversation = await prisma.conversation.create({
                data: {
                    userId,
                    title: content.substring(0, 30) + (content.length > 30 ? "..." : ""),
                }
            });
        }

        // 2. Save User Message
        saveChatMessage(conversation.id, "user", content).catch(err => console.error("BG Save Error:", err));

        // 3. Set Headers and Stream Response
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Transfer-Encoding', 'chunked');
        res.setHeader('x-conversation-id', conversation.id);
        res.setHeader('Access-Control-Expose-Headers', 'x-conversation-id');

        // Disable buffering for smooth streaming
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // Crucial for Nginx/Proxies

        let fullAIResponse = "";
        let isFirstChunk = true;
        const stream = getAIResponse(content, chatHistory);

        for await (const chunk of stream) {
            if (isFirstChunk) {
                const latency = Date.now() - startTime;
                console.log(`>>> [FIRST CHUNK] Latency: ${latency}ms`);
                isFirstChunk = false;
            }
            res.write(chunk);
            fullAIResponse += chunk;
        }

        // 4. Save AI Message
        await saveChatMessage(conversation.id, "ai", fullAIResponse);

        const totalDuration = Date.now() - startTime;
        console.log(`>>> [STREAM COMPLETE] Last chunk sent. Total Duration: ${totalDuration}ms`);
        res.end();

    } catch (error) {

        if (!res.headersSent) {
            res.status(500).json({ error: "Internal server error" });
        } else {
            res.end();
        }
    }
};


export const getConversations = async (req, res) => {
    const userId = req.user.userId;
    try {
        const conversations = await prisma.conversation.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });
        res.status(200).json(conversations);
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
};

export const getMessages = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;
    try {
        const conversation = await prisma.conversation.findUnique({
            where: { id }
        });

        if (!conversation || conversation.userId !== userId) {
            return res.status(404).json({ error: "Conversation not found" });
        }

        const messages = await prisma.message.findMany({
            where: { conversationId: id },
            orderBy: { createdAt: 'asc' }
        });

        res.status(200).json(messages);
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
};

export const deleteConversation = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.userId;
    try {
        // First check if it exists and belongs to the user
        const conversation = await prisma.conversation.findUnique({
            where: { id }
        });

        if (!conversation || conversation.userId !== userId) {
            return res.status(404).json({ error: "Conversation not found" });
        }

        // Delete the conversation - Prisma/DB will handle the messages automatically!
        await prisma.conversation.delete({
            where: { id }
        });

        res.status(200).json({ message: "Conversation deleted successfully" });
    } catch (error) {
        console.error("Delete Error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
