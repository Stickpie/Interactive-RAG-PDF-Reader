from langchain_community.vectorstores import Chroma
from langchain_ollama import OllamaEmbeddings

CHROMA_PATH = "chroma_db"

def view_database():
    """Load and display all documents in the Chroma database."""
    try:
        # Load the existing database
        embeddings = OllamaEmbeddings(model="nomic-embed-text")
        db = Chroma(persist_directory=CHROMA_PATH, embedding_function=embeddings)
        
        # Get all documents
        all_docs = db.get()
        
        print(f"\n{'='*80}")
        print(f"Chroma Database: {CHROMA_PATH}")
        print(f"Total chunks: {len(all_docs['ids'])}")
        print(f"{'='*80}\n")
        
        # Display each document
        for i, (doc_id, doc_text, metadata) in enumerate(zip(
            all_docs['ids'], 
            all_docs['documents'], 
            all_docs['metadatas']
        ), 1):
            print(f"\n{'─'*80}")
            print(f"Chunk {i} (ID: {doc_id})")
            print(f"{'─'*80}")
            print(f"Source: {metadata.get('source', 'N/A')}")
            if 'start_index' in metadata:
                print(f"Start Index: {metadata['start_index']}")
            print(f"\nContent ({len(doc_text)} chars):")
            print(f"{'─'*80}")
            # Print first 500 chars, or full content if shorter
            preview = doc_text[:500] if len(doc_text) > 500 else doc_text
            print(preview)
            if len(doc_text) > 500:
                print(f"\n... ({len(doc_text) - 500} more characters)")
            print()
        
        print(f"\n{'='*80}")
        print(f"Displayed {len(all_docs['ids'])} chunks")
        print(f"{'='*80}\n")
        
    except Exception as e:
        print(f"\nError loading database: {e}")
        print("\nMake sure:")
        print("1. The database exists at the specified path")
        print("2. Ollama is running")
        print("3. The nomic-embed-text model is available")
        raise

if __name__ == "__main__":
    view_database()

