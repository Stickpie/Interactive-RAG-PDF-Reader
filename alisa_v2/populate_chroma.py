import argparse
import os
import re
import shutil
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from get_embedding_function import get_embedding_function
from langchain_chroma import Chroma
from langchain_community.document_loaders import DirectoryLoader, TextLoader

# load_dotenv("secrets.env")
_ROOT = os.path.dirname(os.path.abspath(__file__))
CHROMA_PATH = os.path.join(_ROOT, "chroma_db")
DATA_PATH = os.path.join(_ROOT, "ParsedText")

def main():
    
    # Check if database should be cleared (using the --clear flag)
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action = "store_true", help = "Reset the database.")
    args = parser.parse_args()
    if args.reset:
        print("Clearing Database")
        clear_database()
    
    # Create (or update) the data store
    documents = load_documents()
    chunks = split_documents(documents)
    add_to_chroma(chunks)

def clean_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\t", " ")
    text = text.replace("\u00A0", " ")
    text = text.replace("\u200B", "")
    text = text.replace("\ufeff", "")

    # remove bullet symbols entirely
    text = text.replace("●", " ")
    text = text.replace("○", " ")
    text = text.replace("■", " ")

    # collapse all whitespace into single spaces
    text = re.sub(r"\s+", " ", text)

    return text.strip()

def load_documents():
    loader = DirectoryLoader(
        DATA_PATH,
        glob="*.txt",
        loader_cls=TextLoader,
        loader_kwargs={
            "encoding": "utf-8",
            "autodetect_encoding": True,
        },
    )

    documents = loader.load()
    documents = [
        d
        for d in documents
        if "_unstructured" not in os.path.basename(
            str(d.metadata.get("source", ""))
        ).lower()
    ]

    if not documents:
        return []

    # clean whitespace for each document
    for doc in documents:
        doc.page_content = clean_text(doc.page_content)

    print("AFTER CLEANING:")
    print(repr(documents[0].page_content[:1000]))
    
    return documents

def split_documents(documents: list[Document]):
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size = 800,
        chunk_overlap = 80,
        length_function= len,
        is_separator_regex=False,
    )
    return text_splitter.split_documents(documents)

def add_to_chroma(chunks: list[Document]):
    #load to the existing database
    db = Chroma(
        persist_directory = CHROMA_PATH, embedding_function = get_embedding_function()
    )

    #Calculate Page IDs
    chunks_with_ids = calculate_chunk_ids(chunks)
    all_chunk_ids = [chunk.metadata["id"] for chunk in chunks_with_ids]
    print(f"Chunk IDs from this run ({len(all_chunk_ids)}): {all_chunk_ids}")

    #Add or Update the documents
    existing_items = db.get(include=[]) #IDs are always included by default
    existing_ids = set(existing_items["ids"])
    print(f"Number of existing documents in DB: {len(existing_ids)}")

    #Only add documents that don't exist in the DB
    new_chunks = []
    for chunk in chunks_with_ids:
        if chunk.metadata["id"] not in existing_ids:
            new_chunks.append(chunk)

    if len(new_chunks):
        print(f"Adding new documents: {len(new_chunks)}")
        new_chunk_ids = [chunk.metadata["id"] for chunk in new_chunks]
        db.add_documents(new_chunks, ids=new_chunk_ids)
        #db.persist()
    else:
        print("No new documents to add")

    stored = db.get(include=[])
    print(f"All IDs currently in Chroma ({len(stored['ids'])}): {stored['ids']}")

    #Print the chunks
    for i, chunk in enumerate(chunks_with_ids, start=1):
        print(f"\n--- chunk {i}/{len(chunks_with_ids)} | id={chunk.metadata['id']} ---")
        print(chunk.page_content)

def calculate_chunk_ids(chunks):
    last_source = None
    current_chunk_index = 0

    for chunk in chunks:
        source = chunk.metadata.get("source", "unknown")

        if source == last_source:
            current_chunk_index += 1
        else:
            current_chunk_index = 0

        chunk.metadata["id"] = f"{source}:{current_chunk_index}"
        last_source = source

    return chunks

def clear_database():
    if os.path.exists(CHROMA_PATH):
        shutil.rmtree(CHROMA_PATH)

if __name__ == "__main__":
    main()