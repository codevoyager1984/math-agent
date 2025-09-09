# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a mathematics knowledge agent system with three main components:
- **chatbot/**: Next.js AI chatbot with math capabilities and knowledge search
- **dashboard/**: Mantine-based administrative dashboard for system configuration  
- **rag-server/**: FastAPI-based RAG (Retrieval Augmented Generation) service with ChromaDB for math knowledge

## Architecture

The system follows a microservice architecture:
- The chatbot provides the user interface and integrates with AI providers (DeepSeek, xAI)
- The dashboard manages system configuration and user administration
- The RAG server handles document embeddings and knowledge retrieval using ChromaDB
- ChromaDB runs as a separate Docker container for vector storage

## Development Commands

### Chatbot (Next.js)
```bash
cd chatbot
pnpm dev              # Start development server with Turbo
pnpm build           # Build for production (includes DB migration)
pnpm lint            # Lint with Next.js ESLint + Biome
pnpm lint:fix        # Auto-fix linting issues
pnpm format          # Format code with Biome
pnpm test            # Run Playwright tests
pnpm db:migrate      # Run database migrations
pnpm db:studio       # Open Drizzle Studio
```

### Dashboard (Next.js + Mantine)
```bash
cd dashboard
npm run dev          # Start development server
npm run build        # Build for production  
npm run test         # Run full test suite (prettier, lint, typecheck, jest)
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint + Stylelint
npm run jest         # Jest unit tests
npm run storybook    # Start Storybook dev server
```

### RAG Server (FastAPI + Python)
```bash
cd rag-server
python main.py       # Start FastAPI server
# Or with hot reload: HOT_RELOAD=True python main.py
```

### ChromaDB
```bash
# Run ChromaDB container
docker run -v ./chroma-data:/data -p 18000:8000 chromadb/chroma
```

## Technology Stack

### Frontend Technologies
- **Next.js 15**: React framework with App Router
- **React 19**: Latest React version (RC)
- **Mantine 7**: React components library (dashboard only)
- **Tailwind CSS**: Utility-first CSS (chatbot)
- **TypeScript**: Type safety across frontend

### AI & Data
- **AI SDK**: Vercel AI SDK for LLM integration
- **DeepSeek/xAI**: Primary AI providers
- **ChromaDB**: Vector database for embeddings
- **Sentence Transformers**: Text embeddings (all-MiniLM-L6-v2)

### Backend & Database
- **FastAPI**: Python web framework for RAG service
- **Drizzle ORM**: Type-safe database toolkit (chatbot)
- **Vercel Postgres**: Database backend (chatbot)
- **SQLite**: Local database (rag-server admin)

### Tools & Testing
- **Biome**: Fast linter and formatter (chatbot)
- **ESLint**: JavaScript linting (dashboard)
- **Jest**: Unit testing framework
- **Playwright**: End-to-end testing (chatbot)
- **Storybook**: Component development (dashboard)

## Key Configuration Files

- `chatbot/lib/db/`: Database schema and migrations using Drizzle ORM
- `rag-server/config.py`: Environment-based configuration for RAG service
- `rag-server/main.py`: FastAPI application with CORS and logging setup
- Package managers: `pnpm` (chatbot), `npm` (dashboard), `pip` (rag-server)

## Development Notes

- The chatbot uses pnpm for package management while dashboard uses npm
- Hot reload is configurable via environment variable for the RAG server
- ChromaDB data persists in `./chroma-data` directory
- Database migrations run automatically during chatbot build process
- All services support development and production configurations

## Important Development Guidelines

### Async Operations for External API Calls & File Processing
**CRITICAL**: All external API calls and file I/O operations MUST be implemented as async operations to prevent blocking the FastAPI server and other concurrent requests.

#### External API Calls:
- Use `aiohttp` instead of `requests` for HTTP calls
- Mark all AI service methods as `async` 
- Use `await` when calling external APIs
- Implement proper timeout handling with `aiohttp.ClientTimeout`
- This prevents the entire server from hanging when processing AI requests

#### File Processing Operations:
- Use `aiofiles` for async file I/O operations
- Run CPU-intensive tasks (document parsing, text processing) in thread pools
- Use `asyncio.get_event_loop().run_in_executor()` for blocking operations
- Implement proper resource cleanup with async context managers

Example patterns:
```python
# ❌ BAD - Blocks the entire server
response = requests.post(url, json=data)
with open(file_path, 'rb') as f:
    content = f.read()

# ✅ GOOD - Non-blocking async operations
async with aiohttp.ClientSession(timeout=timeout) as session:
    async with session.post(url, json=data) as response:
        result = await response.json()

async with aiofiles.open(file_path, 'rb') as f:
    content = await f.read()

# For CPU-intensive tasks, use thread pools
loop = asyncio.get_event_loop()
result = await loop.run_in_executor(None, cpu_intensive_function, data)
```

### Comprehensive Logging Requirements
All AI processing and document parsing operations MUST include detailed logging for monitoring, debugging, and performance analysis:

#### Required Log Elements:
- **Request ID Tracking**: Generate unique IDs to trace complete request flows
- **Performance Metrics**: Log timing for each processing stage
- **Input/Output Statistics**: File sizes, text lengths, token usage
- **Error Details**: Full exception info with context
- **Processing Progress**: Stage-by-stage status updates

#### Log Format Pattern:
```
[request_id] Stage description - metrics and details
```

#### Example Implementation:
```python
request_id = str(uuid.uuid4())[:8]
logger.info(f"[{request_id}] Starting document processing: {filename}")
logger.info(f"[{request_id}] File size: {file_size}MB, Type: {file_type}")
logger.info(f"[{request_id}] Text extraction completed in {time:.3f}s")
logger.info(f"[{request_id}] DeepSeek API call - Tokens: {tokens}")
logger.info(f"[{request_id}] Generated {count} knowledge points in {total_time:.3f}s")
```

#### Log Levels:
- **INFO**: Major milestones, timing, statistics
- **DEBUG**: Detailed processing steps, data previews
- **WARNING**: Recoverable issues, skipped data
- **ERROR**: Failures with full context and exception details

This logging standard enables:
- Performance monitoring and bottleneck identification
- Quality tracking of AI-generated content
- Efficient debugging and issue resolution
- Usage analytics and system optimization