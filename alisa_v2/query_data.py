import argparse
import json
import os

from langchain_community.vectorstores import Chroma
from langchain_ollama import OllamaEmbeddings, ChatOllama
from langchain_core.prompts import ChatPromptTemplate

_ROOT = os.path.dirname(os.path.abspath(__file__))
CHROMA_PATH = os.path.join(_ROOT, "chroma_db")
INQUIRE_STATE_PATH = os.path.join(_ROOT, "inquire_state.json")

PROMPT_TEMPLATE = """
The user is struggling to understand this segment of the PDF:

{segment}

Answer the question based only on the following context. Use the internet as a last resort:

{context}

---

Answer the question using easy to understand language based on the above context: 

{question}
"""


def _response_text(response) -> str:
    if hasattr(response, "content"):
        return response.content
    return str(response)


def _query_with_segment(question: str, segment: str) -> str:
    embeddings = OllamaEmbeddings(model="nomic-embed-text")
    db = Chroma(persist_directory=CHROMA_PATH, embedding_function=embeddings)

    results = db.similarity_search_with_relevance_scores(question, k=10)
    if len(results) == 0 or results[0][1] > 0.7:
        parts = ["Unable to find matching results. Closest results:"]
        for r in results[0:2]:
            parts.append("\n")
            parts.append(str(r))
        return "".join(parts)

    context_text = "\n\n--\n\n".join([doc.page_content for doc, _score in results])
    prompt_template = ChatPromptTemplate.from_template(PROMPT_TEMPLATE)
    prompt = prompt_template.format(
        context=context_text,
        question=question,
        segment=segment,
    )

    model = ChatOllama(model="qwen2.5:7b-instruct")
    response = model.invoke(prompt)

    sources = [doc.metadata.get("source", None) for doc, _score in results]
    formatted_response = f"Response: {_response_text(response)}\nSources: {sources}"
    return formatted_response


def run_inquire_from_state_file() -> str:
    """Reads segment and question from inquire_state.json (written by API) and returns the model answer."""
    with open(INQUIRE_STATE_PATH, encoding="utf-8") as f:
        state = json.load(f)
    segment = state.get("segment", "") or ""
    question = (state.get("question") or "").strip()
    if not question:
        return "No question was provided."
    return _query_with_segment(question, segment)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("query_text", type=str, help="The query text.")
    args = parser.parse_args()
    query_text = args.query_text

    segment = ""
    if os.path.isfile(INQUIRE_STATE_PATH):
        with open(INQUIRE_STATE_PATH, encoding="utf-8") as f:
            state = json.load(f)
            segment = state.get("segment", "") or ""

    print(_query_with_segment(query_text, segment))


if __name__ == "__main__":
    main()
