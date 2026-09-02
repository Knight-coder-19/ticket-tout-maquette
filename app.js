const sidebar = document.getElementById("sidebar");
const content = document.getElementById("content");

let docs = [];

async function init() {
  const res = await fetch("docs/index.json");
  docs = await res.json();

  buildSidebar(docs);

  if (docs.length > 0) {
    loadDoc(docs[0].file);
  }
}

function buildSidebar(docs) {
  sidebar.innerHTML = "";

  docs.forEach(doc => {
    const item = document.createElement("div");
    item.className = "nav-item";
    item.textContent = doc.title;

    item.onclick = () => loadDoc(doc.file);

    sidebar.appendChild(item);
  });
}

async function loadDoc(file) {
  const res = await fetch(`docs/${file}`);
  const text = await res.text();

  content.innerHTML = marked.parse(text);

  highlightActive(file);
  addCopyButtons();
  scrollToTop();
}

function highlightActive(activeFile) {
  document.querySelectorAll(".nav-item").forEach((el, index) => {
    el.classList.remove("active");

    if (docs[index].file === activeFile) {
      el.classList.add("active");
    }
  });
}

function scrollToTop() {
  content.scrollTop = 0;
}

function addCopyButtons() {
  document.querySelectorAll("pre").forEach(block => {
    const button = document.createElement("button");
    button.innerText = "Copy";
    button.className = "copy-btn";

    button.onclick = () => {
      const code = block.innerText;
      navigator.clipboard.writeText(code);
      button.innerText = "Copied!";
      setTimeout(() => (button.innerText = "Copy"), 1500);
    };

    block.style.position = "relative";
    block.appendChild(button);
  });
}

init();