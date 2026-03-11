import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "@langchain/core/documents";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
// Naya: MongoDB ke liye imports
import { MongoClient } from "mongodb";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const dataDir = path.join(__dirname, "../data/");

// 1. Connection Strings (Environment variables se fetch karega)
const client = new MongoClient(process.env.MONGODB_URI);
const dbName = "MedicalChatbotDB";
const collectionName = "medical_data";

async function run() {
    try {
        // 1. Load PDF
        const loader = new DirectoryLoader(dataDir, {
            ".pdf": (p) => new PDFLoader(p),
        });
        console.log("Loading documents...");
        const rawDocs = await loader.load();

        // 2. Filter / Clean
        const docs = rawDocs.map(doc => new Document({
            pageContent: doc.pageContent,
            metadata: { source: doc.metadata.source }
        }));

        // 3. Split Text
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 500,
            chunkOverlap: 20,
        });
        const chunked_data = await textSplitter.splitDocuments(docs);
        console.log(`Total chunks created: ${chunked_data.length}`);

        // 4. Initialize Embeddings (HuggingFace model same rahega)
        const embeddings = new HuggingFaceTransformersEmbeddings({
            model: "sentence-transformers/all-MiniLM-L6-v2",
        });

        // 5. Connect to MongoDB and Initialize Vector Search
        console.log("Connecting to MongoDB Atlas (Mumbai)...");
        const collection = client.db(dbName).collection(collectionName);

        // Initialize Vector Store
        const vectorStore = new MongoDBAtlasVectorSearch(embeddings, {
            collection,
            indexName: "medical-chatbot",
            textKey: "text",
            embeddingKey: "embedding",
        });

        // 6. Ingest in Batches
        const batchSize = 50;
        console.log(`Starting ingestion in batches of ${batchSize}...`);

        for (let i = 0; i < chunked_data.length; i += batchSize) {
            const batch = chunked_data.slice(i, i + batchSize);
            const currentBatchCount = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(chunked_data.length / batchSize);

            console.log(`Uploading batch ${currentBatchCount} / ${totalBatches} (${batch.length} chunks)...`);

            await vectorStore.addDocuments(batch);

            console.log(`Batch ${currentBatchCount} uploaded successfully.`);
        }

        console.log("Ingestion Complete! All batches moved to MongoDB Mumbai server.");
    } catch (err) {
        console.error("Error during ingestion:", err);
    } finally {
        await client.close();
    }
}

run();