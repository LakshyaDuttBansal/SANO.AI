// ==============================
// ELEMENTS
// ==============================

const chatMessages = document.getElementById("chatMessages");

const messageInput = document.getElementById("messageInput");

const sendButton = document.getElementById("sendButton");

const clearChatButton = document.getElementById("clearChat");

const typingIndicator = document.getElementById("typingIndicator");

const fileInput = document.getElementById("fileInput");

const attachmentName = document.getElementById("attachmentName");

const menuButton = document.getElementById("menuButton");

const closeSidebarButton = document.getElementById("closeSidebar");

const sidebar = document.querySelector(".sidebar");

const sidebarOverlay = document.getElementById("sidebarOverlay");


// Store the selected file to upload with the next message.
let selectedFile = null;


// Prevent multiple simultaneous responses.
let isResponding = false;


// ==============================
// ESCAPE HTML
// ==============================

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entities[character];
    });
}


// ==============================
// ADD MESSAGE
// ==============================

function addMessage(text, sender, sources) {

    const message = document.createElement("div");

    message.className = "message " +
        (sender === "user" ? "user-message" : "assistant-message");


    const avatar = document.createElement("div");

    avatar.className = "message-avatar";

    avatar.textContent = sender === "user" ? "U" : "✚";


    const content = document.createElement("div");

    content.className = "message-content";


    const bubble = document.createElement("div");

    bubble.className = "message-bubble";


    // Use textContent so user input is displayed safely.
    const paragraph = document.createElement("p");

    paragraph.style.whiteSpace = "pre-wrap";

    paragraph.textContent = text;

    bubble.appendChild(paragraph);

    if (Array.isArray(sources) && sources.length) {
        const src = document.createElement("p");
        src.style.fontSize = "11px";
        src.textContent = "Sources: " + sources.join(" · ");
        bubble.appendChild(src);
    }


    const time = document.createElement("span");

    time.className = "message-time";

    time.textContent = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit"
    });


    content.appendChild(bubble);

    content.appendChild(time);


    if (sender === "user") {

        message.appendChild(content);

        message.appendChild(avatar);

    } else {

        message.appendChild(avatar);

        message.appendChild(content);

    }


    chatMessages.appendChild(message);

    chatMessages.scrollTop = chatMessages.scrollHeight;

}


// ==============================
// DEMO RESPONSES (offline fallback)
// ==============================

function getDemoResponse(question) {

    const text = question.toLowerCase();


    if (
        text.includes("vitamin d") ||
        text.includes("vitamin deficiency")
    ) {

        return "Vitamin D helps your body absorb calcium and supports bone and muscle health. A low result may indicate that your level is below the laboratory's reference range. The significance depends on the actual value, units, symptoms, and medical history. Share the report with your healthcare professional to understand what it means for you.";

    }


    if (
        text.includes("blood test") ||
        text.includes("blood report") ||
        text.includes("cbc") ||
        text.includes("hemoglobin") ||
        text.includes("platelet")
    ) {

        return "I can help explain your blood test in simple language. Please attach your report or enter the test name, result, unit, and laboratory reference range. I can explain what each measurement generally represents, but I cannot confirm a diagnosis from a result alone. Your healthcare professional can interpret the findings in context.";

    }


    if (
        text.includes("medication") ||
        text.includes("medicine") ||
        text.includes("interaction") ||
        text.includes("drug")
    ) {

        return "Medication interactions can depend on the exact medicines, strengths, doses, supplements, and your health history. Enter the full names and strengths listed on your prescriptions, and I can help identify questions to discuss with a pharmacist. This demo does not have a verified drug-interaction database, so do not rely on it to confirm that a combination is safe. Do not change or stop prescribed medication without professional advice.";

    }


    if (
        text.includes("appointment") ||
        text.includes("doctor")
    ) {

        return "Here is a useful checklist for your appointment:\n\n1. List your main symptoms or concerns.\n2. Bring your recent reports and prescriptions.\n3. Note your current medicines and supplements.\n4. Ask what your results mean and whether any follow-up is needed.\n5. Confirm when you should seek further care.\n\nYou can tell me the general purpose of your appointment, and I can help you prepare more specific questions.";

    }


    if (
        text.includes("wellness") ||
        text.includes("healthy") ||
        text.includes("lifestyle")
    ) {

        return "Some useful general wellness habits include:\n\n1. Maintain a regular sleep schedule.\n2. Eat a varied, balanced diet.\n3. Stay physically active in a way that suits your abilities.\n4. Drink water regularly.\n5. Keep up with recommended health checkups.\n\nThe best approach depends on your age, health, and circumstances. These are general suggestions, not a personalized medical assessment.";

    }


    if (
        text.includes("hello") ||
        text.includes("hi") ||
        text.includes("hey")
    ) {

        return "Hello! 👋 Welcome to Sano AI. I can help explain health terminology, organize information from medical reports, and prepare questions for your healthcare provider. What would you like to understand today?";

    }


    return "Thanks for your question! I can help with general health-information questions — try one of the suggested prompts. For record-specific answers, attach a report so I can reference it. Please don't rely on chat for diagnosis or treatment decisions.";

}


// ==============================
// BACKEND (live) with demo fallback
// ==============================

async function fetchReply(question) {
    const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || "Chat request failed.");
    if (!data.reply) throw new Error("Empty chat response.");
    return data;
}

// ==============================
// SEND MESSAGE
// ==============================

function sendMessage(customMessage = null) {

    if (isResponding) {
        return;
    }


    const text = (
        customMessage !== null
            ? customMessage
            : messageInput.value
    ).trim();


    if (!text) {

        if (selectedFile) {
            addMessage("Selected document: " + selectedFile.name, "user");
            void processAttachmentOnly();
            return;
        }

        messageInput.focus();
        return;
    }


    // Show user's message.
    addMessage(text, "user");


    messageInput.value = "";

    messageInput.style.height = "auto";


    const fileToUpload = selectedFile;
    selectedFile = null;
    fileInput.value = "";
    attachmentName.textContent = "";
    attachmentName.classList.add("hidden");


    // Show loading state.
    isResponding = true;

    sendButton.disabled = true;

    typingIndicator.classList.remove("hidden");

    chatMessages.scrollTop = chatMessages.scrollHeight;


    (async function () {
        if (fileToUpload) {
            try {
                const fd = new FormData();
                fd.append("file", fileToUpload);
                const up = await fetch("/api/upload", { method: "POST", body: fd });
                if (!up.ok) throw new Error("Document upload failed.");
                const rec = await up.json();
                addMessage(`Document "${rec.title || fileToUpload.name}" added — answers below can reference it.`, "assistant");
            } catch (e) {
                addMessage("Document upload failed: " + e.message, "assistant");
            }
        }
        try {
            const data = await fetchReply(text);
            addMessage(data.reply, "assistant", data.sources);
        } catch (e) {
            // Offline/backend-down fallback keeps the page usable.
            addMessage(getDemoResponse(text), "assistant");
        } finally {
            typingIndicator.classList.add("hidden");
            isResponding = false;
            sendButton.disabled = false;
            messageInput.focus();
        }
    })();

}

async function processAttachmentOnly() {
    isResponding = true;
    sendButton.disabled = true;
    typingIndicator.classList.remove("hidden");
    const fileToUpload = selectedFile;
    selectedFile = null;
    fileInput.value = "";
    attachmentName.textContent = "";
    attachmentName.classList.add("hidden");
    try {
        const fd = new FormData();
        fd.append("file", fileToUpload);
        const r = await fetch("/api/upload", { method: "POST", body: fd });
        if (!r.ok) throw new Error("Upload failed.");
        const rec = await r.json();
        addMessage(`Document "${rec.title || fileToUpload.name}" added. Ask me about it!`, "assistant");
    } catch (e) {
        addMessage("Document upload failed: " + e.message, "assistant");
    } finally {
        typingIndicator.classList.add("hidden");
        isResponding = false;
        sendButton.disabled = false;
    }
}


// ==============================
// SEND BUTTON
// ==============================

sendButton.addEventListener("click", function () {

    sendMessage();

});


// ==============================
// ENTER TO SEND
// ==============================

messageInput.addEventListener("keydown", function (event) {

    if (
        event.key === "Enter" &&
        !event.shiftKey &&
        !event.isComposing
    ) {

        event.preventDefault();

        sendMessage();

    }

});


// ==============================
// AUTO-RESIZE TEXTAREA
// ==============================

messageInput.addEventListener("input", function () {

    messageInput.style.height = "auto";

    messageInput.style.height =
        Math.min(messageInput.scrollHeight, 130) + "px";

});


// ==============================
// SUGGESTED QUESTIONS
// ==============================

const suggestionCards = document.querySelectorAll(
    ".suggestion-card"
);


suggestionCards.forEach(function (card) {

    card.addEventListener("click", function () {

        const prompt = card.dataset.prompt;

        sendMessage(prompt);

    });

});


// ==============================
// FILE ATTACHMENT
// ==============================

fileInput.addEventListener("change", function () {

    const file = fileInput.files[0];


    if (!file) {
        return;
    }


    const maxSize = 10 * 1024 * 1024;


    if (file.size > maxSize) {

        alert("Please select a file smaller than 10 MB.");

        fileInput.value = "";

        selectedFile = null;

        attachmentName.classList.add("hidden");

        return;

    }


    selectedFile = file;


    attachmentName.textContent = "📎 " + file.name;

    attachmentName.classList.remove("hidden");

});


// ==============================
// CLEAR CONVERSATION
// ==============================

clearChatButton.addEventListener("click", function () {

    if (isResponding) {
        return;
    }


    chatMessages.innerHTML = "";


    addWelcomeMessage();

});


// ==============================
// WELCOME MESSAGE
// ==============================

function addWelcomeMessage() {

    const message = document.createElement("div");

    message.className = "message assistant-message";


    message.innerHTML = `
        <div class="message-avatar">✚</div>

        <div class="message-content">

            <div class="message-bubble">

                <p class="message-greeting">
                    Hey there! 👋
                </p>

                <h3>How can I help you today?</h3>

                <p>
                    I can help you understand medical terminology,
                    organize your health information, and prepare
                    questions for your healthcare provider.
                </p>

                <div class="welcome-features">

                    <span>✓ Simple explanations</span>

                    <span>✓ Health record insights</span>

                    <span>✓ Appointment preparation</span>

                </div>

            </div>

            <span class="message-time">
                Your health companion
            </span>

        </div>
    `;


    chatMessages.appendChild(message);

    chatMessages.scrollTop = chatMessages.scrollHeight;

}


// ==============================
// MOBILE SIDEBAR
// ==============================

function openSidebar() {

    sidebar.classList.add("open");

    sidebarOverlay.classList.add("visible");

}


function closeSidebar() {

    sidebar.classList.remove("open");

    sidebarOverlay.classList.remove("visible");

}


menuButton.addEventListener("click", openSidebar);

closeSidebarButton.addEventListener("click", closeSidebar);

sidebarOverlay.addEventListener("click", closeSidebar);


// Close mobile sidebar after selecting a navigation item.
document.querySelectorAll(".nav-item").forEach(function (item) {

    item.addEventListener("click", function () {

        if (window.innerWidth <= 800) {

            closeSidebar();

        }

    });

});
