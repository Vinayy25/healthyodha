from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.docstore.document import Document
import os
from dotenv import load_dotenv
import re

# Load environment variables from parent directory
load_dotenv(dotenv_path="../.env")

app = FastAPI(title="HealthYoda RAG Service")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Query(BaseModel):
    query: str
    k: int = 3  # Number of relevant chunks to retrieve

class RAGResponse(BaseModel):
    context: str
    sources: list[str]
    num_chunks: int

# Global variables for vector store
faiss_db = None
chunk_metadata = []

def smart_chunk_handbook(text: str) -> list[Document]:
    """
    Smart chunking that splits by symptom/condition while preserving structure
    """
    documents = []
    
    # Split by major sections (conditions/symptoms)
    # Pattern: Look for lines that are likely symptom names (capitalized, short)
    lines = text.split('\n')
    
    current_symptom = None
    current_section = []
    current_system = "General"
    
    for line in lines:
        stripped = line.strip()
        
        # Detect system headers (e.g., "Cardiac System")
        if "System" in stripped and "─" in stripped:
            if current_section:
                # Save previous section
                content = '\n'.join(current_section)
                if len(content.strip()) > 50:  # Only save substantial chunks
                    documents.append(Document(
                        page_content=content,
                        metadata={
                            "system": current_system,
                            "symptom": current_symptom or "Overview",
                            "type": "medical_history_framework"
                        }
                    ))
            current_section = [line]
            # Extract system name
            match = re.search(r'([A-Z][a-zA-Z\s]+) System', stripped)
            if match:
                current_system = match.group(1)
            current_symptom = None
            continue
        
        # Detect symptom headers (short lines, mostly capitalized, not questions)
        if (stripped and 
            not stripped.startswith('Q:') and 
            not stripped.startswith('-') and
            not stripped.startswith('Possible') and
            len(stripped) < 50 and
            stripped[0].isupper() and
            not '─' in stripped):
            
            # This might be a new symptom
            # Check if it's a known section keyword
            section_keywords = ['Chief Complaint', 'Onset/Duration', 'Quality/Severity', 
                              'Aggravating/Relieving', 'Associated Symptoms', 'Red Flags',
                              'ROS', 'Context', 'Wrap-up', 'Table of Contents']
            
            is_section_keyword = any(keyword in stripped for keyword in section_keywords)
            
            if not is_section_keyword and len(current_section) > 5:
                # Save previous symptom
                content = '\n'.join(current_section)
                if len(content.strip()) > 100:
                    documents.append(Document(
                        page_content=content,
                        metadata={
                            "system": current_system,
                            "symptom": current_symptom or "Overview",
                            "type": "medical_history_framework"
                        }
                    ))
                current_section = [line]
                current_symptom = stripped
                continue
        
        current_section.append(line)
    
    # Don't forget the last section
    if current_section:
        content = '\n'.join(current_section)
        if len(content.strip()) > 100:
            documents.append(Document(
                page_content=content,
                metadata={
                    "system": current_system,
                    "symptom": current_symptom or "Overview",
                    "type": "medical_history_framework"
                }
            ))
    
    print(f"📚 Created {len(documents)} smart chunks from handbook")
    return documents

def fallback_chunk_handbook(text: str) -> list[Document]:
    """
    Fallback chunking strategy using RecursiveCharacterTextSplitter
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=150,
        separators=["\n\n", "\n", ".", "!", "?", ",", " ", ""],
    )
    chunks = splitter.split_text(text)
    documents = [Document(page_content=chunk) for chunk in chunks]
    print(f"📚 Created {len(documents)} chunks using fallback strategy")
    return documents

@app.on_event("startup")
async def startup_event():
    """Initialize the vector store on startup"""
    global faiss_db, chunk_metadata
    
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    if not OPENAI_API_KEY:
        print("❌ OPENAI_API_KEY not found in environment variables")
        raise RuntimeError("OPENAI_API_KEY not configured")
    
    print("🚀 Initializing RAG Service...")
    
    # Load handbook
    handbook_path = "../handbook.txt"
    if not os.path.exists(handbook_path):
        print(f"❌ Handbook not found at {handbook_path}")
        raise FileNotFoundError(f"handbook.txt not found at {handbook_path}")
    
    with open(handbook_path, 'r', encoding='utf-8') as f:
        text = f.read()
    
    print(f"📖 Loaded handbook: {len(text)} characters")
    
    # Try smart chunking first
    try:
        docs = smart_chunk_handbook(text)
        if len(docs) < 5:  # If too few chunks, use fallback
            print("⚠️ Smart chunking produced too few chunks, using fallback")
            docs = fallback_chunk_handbook(text)
    except Exception as e:
        print(f"⚠️ Smart chunking failed: {e}, using fallback")
        docs = fallback_chunk_handbook(text)
    
    # Store metadata for later reference
    chunk_metadata = [
        {
            "content_preview": doc.page_content[:100] + "...",
            "metadata": doc.metadata if hasattr(doc, 'metadata') else {}
        }
        for doc in docs
    ]
    
    # Create embeddings and vector store
    print("🔢 Creating embeddings...")
    embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
    
    try:
        faiss_db = FAISS.from_documents(docs, embeddings)
        print(f"✅ RAG Service initialized with {len(docs)} chunks")
    except Exception as e:
        print(f"❌ Failed to create FAISS index: {e}")
        raise

@app.get("/")
async def root():
    return {
        "service": "HealthYoda RAG Service",
        "status": "running",
        "chunks_loaded": len(chunk_metadata),
        "version": "1.0.0"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    if faiss_db is None:
        raise HTTPException(status_code=503, detail="Vector store not initialized")
    
    return {
        "status": "healthy",
        "chunks_loaded": len(chunk_metadata),
        "ready": True
    }

@app.post("/rag", response_model=RAGResponse)
async def rag_lookup(query: Query):
    """
    Retrieve relevant context from the medical handbook based on query
    """
    if faiss_db is None:
        raise HTTPException(status_code=503, detail="Vector store not initialized")
    
    try:
        # Perform similarity search
        results = faiss_db.similarity_search(query.query, k=query.k)
        
        # Extract context and sources
        context_parts = []
        sources = []
        
        for i, doc in enumerate(results, 1):
            context_parts.append(f"[Source {i}]\n{doc.page_content}")
            
            # Get metadata if available
            if hasattr(doc, 'metadata') and doc.metadata:
                source_info = f"{doc.metadata.get('system', 'Unknown')} - {doc.metadata.get('symptom', 'Unknown')}"
            else:
                source_info = f"Chunk {i}"
            sources.append(source_info)
        
        context = "\n\n---\n\n".join(context_parts)
        
        print(f"🔍 RAG Query: '{query.query}' -> Retrieved {len(results)} chunks")
        
        return RAGResponse(
            context=context,
            sources=sources,
            num_chunks=len(results)
        )
    
    except Exception as e:
        print(f"❌ RAG lookup error: {e}")
        raise HTTPException(status_code=500, detail=f"RAG lookup failed: {str(e)}")

@app.get("/chunks")
async def list_chunks():
    """List all chunks for debugging"""
    return {
        "total_chunks": len(chunk_metadata),
        "chunks": chunk_metadata[:10]  # Return first 10 for preview
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000)

