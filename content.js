function isTextBox(element) {
    const tag = element.tagName.toLowerCase();
    return (
        (tag === "input" && (element.type === "text" || element.type === "password")) ||
        tag === "textarea" ||
        element.contentEditable === "true"
    );
}

function normalizeString(str) {
    return (str || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function capitalizeFirst(str) {
    const s = (str || "").trim();
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function keywordMatchesTitle(normalizedTitle, normalizedKeyword) {
    if (!normalizedKeyword) return false;
    if (normalizedKeyword.includes(" ")) {
        return normalizedTitle.includes(normalizedKeyword);
    }
    const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp("\\b" + escaped + "\\b", "i");
    return re.test(normalizedTitle);
}

let __deptDictPromise = null;

function loadDepartmentDictionary() {
    if (__deptDictPromise) return __deptDictPromise;
    __deptDictPromise = fetch(chrome.runtime.getURL("title_department_dictionary.json"))
        .then((r) => r.json())
        .catch(() => ({}));
    return __deptDictPromise;
}

async function resolveDepartmentFromTitle(titleOrDeptText) {
    const raw = (titleOrDeptText || "").trim();
    const normalized = normalizeString(raw);
    if (!normalized) return raw;

    const dict = await loadDepartmentDictionary();

    for (const department of Object.keys(dict || {})) {
        const list = Array.isArray(dict[department]) ? dict[department] : [];
        for (const k of list) {
            const keyword = normalizeString(k);
            if (keyword && keywordMatchesTitle(normalized, keyword)) {
                return department;
            }
        }
    }

    return capitalizeFirst(raw);
}

function showThanksDan() {
    const popup = document.createElement("div");
    popup.innerText = "thanks dan!";

    const fontSize = Math.floor(Math.random() * 11) + 10;
    popup.style.fontSize = `${fontSize}px`;
    popup.style.fontFamily = "Comic Sans MS";
    popup.style.position = "fixed";
    popup.style.bottom = "20px";
    popup.style.right = "20px";
    popup.style.padding = "10px";
    popup.style.backgroundColor = "yellow";
    popup.style.border = "2px solid black";
    popup.style.zIndex = "9999";
    popup.style.borderRadius = "8px";

    document.body.appendChild(popup);

    setTimeout(() => {
        popup.remove();
    }, 2000);
}

document.addEventListener("keydown", function (event) {
    chrome.storage.sync.get(["hotkeyEnabled"], function (data) {
        if (data.hotkeyEnabled !== false) {
            if (event.ctrlKey && event.shiftKey && event.code === "KeyD") {
                const activeElement = document.activeElement;

                if (isTextBox(activeElement)) {
                    event.preventDefault();
                    showThanksDan();
                }
            }
        }
    });
});

function runScript() {
    (function () {
        async function findContactInfo() {
            let contactInfo = {};
            let titlebar = document.evaluate(
                "/html/body/div[1]/div[1]/div[1]/span[1]",
                document,
                null,
                XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                null
            );

            if (titlebar.snapshotLength > 0) {
                let mode = titlebar.snapshotItem(0).textContent.trim();
                window.mode = mode;

                if (mode === "New Ticket") {
                    contactInfo.email = document.querySelector('.Content a[href^="mailto:"]')?.textContent;

                    let mobileCandidate = document.evaluate(
                        "/html/body/div[4]/div[3]/div[2]/div[2]/div[2]/div[1]/div[21]",
                        document,
                        null,
                        XPathResult.FIRST_ORDERED_NODE_TYPE,
                        null
                    ).singleNodeValue;

                    if (mobileCandidate && mobileCandidate.textContent.toLowerCase().includes("(mobile)")) {
                        contactInfo.phone = mobileCandidate.textContent.trim();
                    } else {
                        let phoneElements = document.evaluate(
                            '/html/body/div[4]/div[3]/div[2]/div[2]/div[2]/div[1]/div[contains(@class, "Text") and not(contains(@class, "Address")) and not(contains(@class, "HighImportance"))]',
                            document,
                            null,
                            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                            null
                        );

                        for (let i = 0; i < phoneElements.snapshotLength; i++) {
                            let phone = phoneElements.snapshotItem(i)?.textContent.trim();
                            if (phone && phone.match(/^\+?[0-9-().\s]+$/)) {
                                contactInfo.phone = phone;
                                break;
                            }
                        }
                    }

                    let nameFrom15 = document.evaluate(
                        "/html/body/div[4]/div[3]/div[2]/div[2]/div[2]/div[1]/div[15]/div[1]/div/div/div",
                        document,
                        null,
                        XPathResult.FIRST_ORDERED_NODE_TYPE,
                        null
                    ).singleNodeValue;

                    let deptElem16 = document.evaluate(
                        "/html/body/div[4]/div[3]/div[2]/div[2]/div[2]/div[1]/div[16]",
                        document,
                        null,
                        XPathResult.FIRST_ORDERED_NODE_TYPE,
                        null
                    ).singleNodeValue;

                    let deptText16 = deptElem16 ? deptElem16.textContent.trim() : "";
                    let deptText15 = "";

                    if (nameFrom15) {
                        contactInfo.name = nameFrom15.textContent.trim();
                        contactInfo.department = deptText16 && deptText16 !== contactInfo.name ? deptText16 : "";
                    } else {
                        deptText15 =
                            document.evaluate(
                                "/html/body/div[4]/div[3]/div[2]/div[2]/div[2]/div[1]/div[15]",
                                document,
                                null,
                                XPathResult.FIRST_ORDERED_NODE_TYPE,
                                null
                            ).singleNodeValue?.textContent.trim() || "";
                        contactInfo.department = deptText15;
                        contactInfo.name =
                            document.evaluate(
                                "/html/body/div[4]/div[3]/div[2]/div[2]/div[2]/div[1]/div[14]/div[1]/div/div/div",
                                document,
                                null,
                                XPathResult.FIRST_ORDERED_NODE_TYPE,
                                null
                            ).singleNodeValue?.textContent.trim() || "";
                    }

                    if (!contactInfo.name) {
                        contactInfo.name =
                            document.querySelector('.Content .LinkButtonWrapper2[title="Open Contact Detail"] .Text2')?.textContent.trim() ||
                            "";
                    }

                    contactInfo.departmentIsBlank = !contactInfo.department;

                    contactInfo.location = document.evaluate(
                        "/html/body/div[4]/div[3]/div[2]/div[2]/div[2]/div[1]/div[1]/div/div/div",
                        document,
                        null,
                        XPathResult.FIRST_ORDERED_NODE_TYPE,
                        null
                    ).singleNodeValue?.textContent;
                } else if (mode === "Edit Ticket -") {
                    contactInfo.email = document.querySelector('.Content a[href^="mailto:"]')?.textContent;

                    let mobileCandidate = document.evaluate(
                        "/html/body/div[4]/div[3]/div[2]/div[2]/div[2]/div[1]/div[21]",
                        document,
                        null,
                        XPathResult.FIRST_ORDERED_NODE_TYPE,
                        null
                    ).singleNodeValue;

                    if (mobileCandidate && mobileCandidate.textContent.toLowerCase().includes("(mobile)")) {
                        contactInfo.phone = mobileCandidate.textContent.trim();
                    } else {
                        let phoneElements = document.evaluate(
                            '/html/body/div[4]/div[3]/div[2]/div[2]/div[2]/div[1]/div[contains(@class, "Text") and not(contains(@class, "Address")) and not(contains(@class, "HighImportance"))]',
                            document,
                            null,
                            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                            null
                        );

                        for (let i = 0; i < phoneElements.snapshotLength; i++) {
                            let phone = phoneElements.snapshotItem(i)?.textContent.trim();
                            if (phone && phone.match(/^\+?[0-9-().\s]+$/)) {
                                contactInfo.phone = phone;
                                break;
                            }
                        }
                    }

                    let nameFrom15 = document.evaluate(
                        "/html/body/div[4]/div[3]/div[2]/div[2]/div[2]/div[1]/div[15]/div[1]/div/div/div",
                        document,
                        null,
                        XPathResult.FIRST_ORDERED_NODE_TYPE,
                        null
                    ).singleNodeValue;

                    let deptElem16 = document.evaluate(
                        "/html/body/div[4]/div[3]/div[2]/div[2]/div[2]/div[1]/div[16]",
                        document,
                        null,
                        XPathResult.FIRST_ORDERED_NODE_TYPE,
                        null
                    ).singleNodeValue;

                    let deptText16 = deptElem16 ? deptElem16.textContent.trim() : "";
                    let deptText15 = "";

                    if (nameFrom15) {
                        contactInfo.name = nameFrom15.textContent.trim();
                        contactInfo.department = deptText16 && deptText16 !== contactInfo.name ? deptText16 : "";
                    } else {
                        deptText15 =
                            document.evaluate(
                                "/html/body/div[4]/div[3]/div[2]/div[2]/div[2]/div[1]/div[15]",
                                document,
                                null,
                                XPathResult.FIRST_ORDERED_NODE_TYPE,
                                null
                            ).singleNodeValue?.textContent.trim() || "";
                        contactInfo.department = deptText15;
                        contactInfo.name =
                            document.evaluate(
                                "/html/body/div[4]/div[3]/div[2]/div[2]/div[2]/div[1]/div[14]/div[1]/div/div/div",
                                document,
                                null,
                                XPathResult.FIRST_ORDERED_NODE_TYPE,
                                null
                            ).singleNodeValue?.textContent.trim() || "";
                    }

                    if (!contactInfo.name) {
                        contactInfo.name =
                            document.querySelector('.Content .LinkButtonWrapper2[title="Open Contact Detail"] .Text2')?.textContent.trim() ||
                            "";
                    }

                    contactInfo.departmentIsBlank = !contactInfo.department;

                    contactInfo.location = document.evaluate(
                        "/html/body/div[4]/div[3]/div[2]/div[2]/div[2]/div[1]/div[1]/div/div/div",
                        document,
                        null,
                        XPathResult.FIRST_ORDERED_NODE_TYPE,
                        null
                    ).singleNodeValue?.textContent;
                }
            }

            contactInfo.department = await resolveDepartmentFromTitle(contactInfo.department);

            return contactInfo;
        }

        function setTicketTitle(contactInfo) {
            let titleElement = document.evaluate(
                "/html/body/div[4]/div[2]/div[1]/div[1]/div/div[3]/div/div[1]/textarea",
                document,
                null,
                XPathResult.FIRST_ORDERED_NODE_TYPE,
                null
            ).singleNodeValue;

            if (!titleElement) {
                console.error("Title element not found");
                return;
            }

            const existingTitle = (titleElement.value || "").trim();
            const parts = existingTitle
                .split(" - ")
                .map((p) => p.trim())
                .filter(Boolean);

            const locNorm = normalizeString(contactInfo.location);
            const deptNorm = normalizeString(contactInfo.department);
            const nameNorm = normalizeString(contactInfo.name);

            let issueParts = [];

            if (parts.length >= 3 && normalizeString(parts[0]) === locNorm) {
                const p1 = normalizeString(parts[1]);
                const p2 = normalizeString(parts[2]);

                if (parts.length >= 4 && p1 === deptNorm && p2 === nameNorm) {
                    issueParts = parts.slice(3);
                } else {
                    issueParts = parts.slice(2);
                }
            } else {
                issueParts = parts;
            }

            const issue = issueParts.join(" - ").trim();

            let ticketTitle = [contactInfo.location, contactInfo.department, contactInfo.name]
                .filter((part) => part && String(part).trim() !== "")
                .join(" - ");

            if (issue) ticketTitle += " - " + issue;

            titleElement.value = ticketTitle + " ";
            titleElement.dispatchEvent(new Event("input", { bubbles: true }));
            titleElement.value = ticketTitle;
            titleElement.dispatchEvent(new Event("input", { bubbles: true }));
        }

        function setTicketDescription(contactInfo) {
            let descriptionElement = null;

            if (window.mode === "New Ticket") {
                descriptionElement = document.evaluate(
                    "/html/body/div[4]/div[2]/div/div[2]/div/div[1]/div/div[2]/div/div/div/div[1]/div[2]/div[1]",
                    document,
                    null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                    null
                ).singleNodeValue;
            } else if (window.mode === "Edit Ticket -") {
                descriptionElement = document.evaluate(
                    "/html/body/div[4]/div[2]/div[1]/div[2]/div/div[1]/div/div[2]/div/div/div/div[1]/div[2]/div[1]",
                    document,
                    null,
                    XPathResult.FIRST_ORDERED_NODE_TYPE,
                    null
                ).singleNodeValue;
            }

            if (descriptionElement) {
                let description = "";

                if (contactInfo.name) {
                    description += `Name: ${contactInfo.name}\n`;
                }
                if (contactInfo.department) {
                    description += `Department: ${contactInfo.department}\n`;
                }
                if (contactInfo.location) {
                    description += `Location: ${contactInfo.location}\n`;
                }
                if (contactInfo.email) {
                    description += `Email: ${contactInfo.email}\n`;
                }
                if (contactInfo.phone) {
                    description += `Phone: ${contactInfo.phone}\n`;
                }

                descriptionElement.innerText = description + "\n";

                descriptionElement.dispatchEvent(new Event("input", { bubbles: true }));
            }
        }

        function setDropdownToYes() {
            const dropdown = document.querySelector("select");
            if (dropdown) {
                dropdown.value = "Yes";
                dropdown.dispatchEvent(new Event("change", { bubbles: true }));
            }
        }

        function selectQueueOption(queueValue) {
            return { action: "selectQueue", queueValue: queueValue };
        }

        function selectPrimaryResource(resourceValue) {
            return { action: "selectPrimaryResource", resourceValue: resourceValue };
        }

        function executeSelection(selectionAction) {
            const dropdown = document.querySelector("select");
            if (dropdown) {
                for (let option of dropdown.options) {
                    if (option.textContent.includes(selectionAction.queueValue || selectionAction.resourceValue)) {
                        dropdown.value = option.value;
                        dropdown.dispatchEvent(new Event("change", { bubbles: true }));
                        return;
                    }
                }
            }
        }

        function setPCNameField(contactInfo) {
            let pcNameElement = document.querySelector('input[type="text"]');
            if (pcNameElement) {
                chrome.storage.sync.get(["pcname"], (data) => {
                    if (data.pcname && data.pcname.trim() !== "" && data.pcname.trim() !== "undefined") {
                        pcNameElement.value = data.pcname;
                        pcNameElement.dispatchEvent(new Event("input", { bubbles: true }));
                    }
                });
            }
        }

        async function main() {
            let contactInfo = await findContactInfo();
            setTicketTitle(contactInfo);
            setTicketDescription(contactInfo);
            setDropdownToYes();
            setPCNameField(contactInfo);

            if (window.mode === "New Ticket") {
                chrome.storage.sync.get(["queue"], (data) => {
                    if (data.queue && data.queue.trim() !== "" && data.queue.trim() !== "undefined") {
                        chrome.runtime.sendMessage(selectQueueOption(data.queue));
                    }
                });
            }

            if (window.mode === "New Ticket") {
                chrome.storage.sync.get(["primaryResource"], (data) => {
                    if (data.primaryResource && data.primaryResource.trim() !== "" && data.primaryResource.trim() !== "undefined") {
                        chrome.runtime.sendMessage(selectPrimaryResource(data.primaryResource));
                    }
                });
            }
        }

        chrome.runtime.onMessage.addListener((message) => {
            if (message.action === "selectQueue") {
                executeSelection(message);
            }
            if (message.action === "selectPrimaryResource") {
                executeSelection(message);
            }
        });

        function sanitize(value) {
            if (typeof value === "string") return value.slice(0, 2000);
            if (value instanceof Error) return value.stack || value.message;
            try {
                return JSON.stringify(value, null, 2);
            } catch {
                return String(value);
            }
        }

        function getTicketTitle() {
            try {
                const titleElement = document.querySelector("textarea");
                return titleElement?.value?.trim() || "N/A";
            } catch {
                return "N/A";
            }
        }

        function getStoredData() {
            return new Promise((resolve) => {
                chrome.storage.sync.get(null, (data) => resolve(data || {}));
            });
        }

        function sendToWebhook(payload) {
            chrome.storage.sync.get(["webhookUrl"], (data) => {
                const url = data.webhookUrl;
                if (!url || !url.trim()) return;

                try {
                    fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    });
                } catch {}
            });
        }

        async function buildContextLog(type, details) {
            const stored = await getStoredData();
            const log = {
                type,
                mode: window.mode || "Unknown",
                url: location.href,
                title: getTicketTitle(),
                timestamp: new Date().toISOString(),
                stored,
                details,
            };
            return log;
        }

        window.addEventListener("error", async (event) => {
            const log = await buildContextLog("error", {
                message: sanitize(event.message),
                filename: sanitize(event.filename),
                lineno: sanitize(event.lineno),
                colno: sanitize(event.colno),
                error: sanitize(event.error),
            });
            sendToWebhook(log);
        });

        window.addEventListener("unhandledrejection", async (event) => {
            const log = await buildContextLog("unhandledrejection", {
                reason: sanitize(event.reason),
            });
            sendToWebhook(log);
        });

        main();
    })();
}

runScript();
