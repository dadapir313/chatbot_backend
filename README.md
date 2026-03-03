# Dr. Nura AI - Medical Chatbot

Dr. Nura AI is a sophisticated, professional healthcare assistant designed to provide reliable medical and health-related information. Built with a modern AI stack, it leverages Retrieval-Augmented Generation (RAG) to ensure accuracy and context-aware responses.

---

## 🏗️ Architecture Detail

The system follows a standard Controller-Service pattern, orchestrated by LangChain for AI workflows:

1.  **Request Handling**: Express.js receives user queries.
2.  **Optimization Layer**: A "Fast Path" detects greetings to provide instant responses, bypassing the LLM chain.
3.  **Context retrieval**: 
    - Queries are embedded using Hugging Face (MiniLM-L6).
    - Pinecone performs a similarity search against a curated medical knowledge base.
4.  **Orchestration**: LangChain rephrases queries based on conversation history and injects retrieved context.
5.  **LLM Generation**: Groq (Llama 3.1) generates streaming responses in real-time.
6.  **Persistence**: Conversations and user data are managed via Prisma with PostgreSQL.

---

## ⚙️ Architectural Decisions & Trade-offs

| Decision | Implementation | Trade-off |
| :--- | :--- | :--- |
| **LLM Provider** | Groq (Llama 3.1) | Faster inference and lower cost compared to OpenAI, with slightly less general reasoning but high medical accuracy. |
| **Retrieval Mode** | History-Aware Retrieval | Adds a rephrasing step which increases first-token latency but ensures multi-turn context accuracy. |
| **Embeddings** | HF Inference API | Offloads compute from the backend server to external infrastructure, trading network latency for local CPU/RAM savings. |
| **Response Type** | Real-time Streaming | Improves perceived performance and user UX significantly over wait-for-complete responses. |
| **Database** | Prisma + PG | Provides strong consistency and developer productivity over NoSQL alternatives for structured chat logs. |

---

## ✨ Features

- 🩺 **Medical Expertise**: Fine-tuned system prompts for professional medical guidance.
- 💬 **Multi-turn Conversations**: Remembers previous context for meaningful follow-ups.
- ⚡ **Instant Greetings**: Optimized response paths for common non-medical interactions.
- 🔐 **Secure Auth**: JWT-based authentication with bcrypt password hashing.
- 🌊 **Streaming Responses**: Smooth, real-time message delivery.
- 📚 **RAG Powered**: Grounded in external medical data to minimize hallucinations.

---

## 🛠️ Tech Stack

- **Runtime**: [Node.js](https://nodejs.org/) (ES Modules)
- **Framework**: [Express.js](https://expressjs.com/)
- **AI Orchestration**: [LangChain](https://js.langchain.com/) & [Vercel AI SDK](https://sdk.vercel.ai/)
- **LLM**: [Groq](https://groq.com/) (Llama-3.1-8b-instant)
- **Vector DB**: [Pinecone](https://www.pinecone.io/)
- **Embeddings**: [Hugging Face](https://huggingface.co/) (sentence-transformers/all-MiniLM-L6-v2)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **Logging**: [Winston](https://github.com/winstonjs/winston)

---

## 📂 Project Structure

```text
chatbot/using_Nodejs/
├── prisma/                # Database schema & migrations
├── src/
│   ├── controllers/      # Route handlers (Auth, Chat, Health)
│   ├── lib/              # Core logic (LLM config, Prisma client)
│   ├── middleware/       # JWT Auth & Security
│   ├── routes/           # API Endpoint definitions
│   └── server.js         # Application entry point
├── research/             # Experimental scripts & data
├── data/                 # Local data assets
├── .env                  # Environment variables (Global)
└── package.json          # Dependencies & Scripts
```

---

## 🚀 Getting Started (Local Development)

### 1. Prerequisites
- Node.js (v18+)
- PostgreSQL instance
- Pinecone Index (Medical data pre-loaded)
- API Keys: Groq, Pinecone, Hugging Face

### 2. Installation
```bash
npm install
```

### 3. Environment Setup
Create a `.env` file in the root:
```env
PORT=5000
DATABASE_URL="postgresql://user:password@localhost:5432/dbname"
JWT_SECRET="your_secret"
GROQ_API_KEY="your_groq_key"
PINECONE_API_KEY="your_pinecone_key"
HUGGINGFACEHUB_API_TOKEN="your_hf_token"
```

### 4. Database Initialization
```bash
npx prisma generate
npx prisma db push
```

### 5. Running the App
```bash
# Development mode
npm run dev

# Production mode
npm start
```

---


