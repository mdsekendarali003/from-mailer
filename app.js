/**
 * MailStream — FormSubmit.co Invoice & Email Dispatcher
 * Routes through primary verified email (mdsekendarali6@gmail.com) and CCs the client.
 * CC'd recipients never get activation links from FormSubmit.
 */

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    if (window.lucide) {
        lucide.createIcons();
    }

    // --- CONFIGURATION ---
    const DEFAULT_ROUTER_EMAIL = 'mdsekendarali6@gmail.com';
    const ROUTER_STORAGE_KEY = 'mailstream_router_email';
    let PRIMARY_ROUTER_EMAIL = DEFAULT_ROUTER_EMAIL;
    try {
        const savedRouter = localStorage.getItem(ROUTER_STORAGE_KEY);
        if (savedRouter) PRIMARY_ROUTER_EMAIL = savedRouter;
    } catch (e) { /* ignore */ }
    // FormSubmit's /ajax/ endpoint silently drops file uploads — attachments only
    // work against the standard endpoint. Sending Accept: application/json still
    // gets us a JSON response back instead of an HTML redirect page.
    const getFormSubmitEndpoint = () => `https://formsubmit.co/${PRIMARY_ROUTER_EMAIL}`;

    // --- STATE ---
    let currentMode = 'invoice'; // 'invoice' | 'standard'

    // Amount is fixed — the itemized table/tax/discount UI are hidden and this
    // is the sole line item, always priced at $499 with 0% tax.
    let lineItems = [
        { description: 'Service', quantity: 1, rate: 499 },
    ];

    const STORAGE_KEYS = {
        DEFAULT_RECIPIENT: 'mailstream_default_recipient',
        HISTORY: 'mailstream_history'
    };

    // Presets definition
    const INVOICE_PRESETS = {
        webdev: {
            subject: "Invoice #INV-2026-001 from Apex Digital Studio",
            senderName: "Apex Digital Studio",
            senderEmail: "billing@apexdigital.com",
            senderAddress: "742 Evergreen Terrace, Suite 100",
            clientName: "Acme Corporation",
            clientAddress: "100 Market St, San Francisco, CA",
            taxRate: 8,
            discount: 0,
            notes: "Bank: Silicon Valley Bank\nAccount: 987654321\nRouting: SVBLUS6S\nPayment Terms: Net 30 days.",
            items: [
                { description: 'Fullstack Web Application Development', quantity: 1, rate: 2200 },
                { description: 'UI/UX Design System & Interactive Prototypes', quantity: 1, rate: 800 },
                { description: 'Cloud Infrastructure & Deployment Setup', quantity: 1, rate: 450 }
            ]
        },
        design: {
            subject: "Invoice #INV-2026-002 — UI/UX Design Sprint",
            senderName: "Apex Design Co.",
            senderEmail: "design@apexdigital.com",
            senderAddress: "450 Creative Way, New York, NY",
            clientName: "Starlight Media LLC",
            clientAddress: "800 Broadway, New York, NY",
            taxRate: 10,
            discount: 100,
            notes: "Payment via Wire / ACH or Stripe Invoice Link.\nDue upon receipt.",
            items: [
                { description: 'Mobile App High-Fidelity Wireframes (15 screens)', quantity: 1, rate: 1400 },
                { description: 'Design Tokens & Component Library', quantity: 1, rate: 600 },
                { description: 'User Flow Animation & Prototyping', quantity: 1, rate: 300 }
            ]
        },
        retainer: {
            subject: "Monthly Engineering Retainer — Invoice #INV-2026-003",
            senderName: "Apex Digital Studio",
            senderEmail: "billing@apexdigital.com",
            senderAddress: "742 Evergreen Terrace, Suite 100",
            clientName: "Nexlify Technologies",
            clientAddress: "220 Tech Blvd, Austin, TX",
            taxRate: 0,
            discount: 0,
            notes: "Monthly Retainer for ongoing support & DevOps maintenance.\nTerms: Net 15 days.",
            items: [
                { description: 'Dedicated DevOps & Infrastructure Maintenance (40 hrs)', quantity: 1, rate: 1500 }
            ]
        },
        consulting: {
            subject: "Cloud Architecture Consulting — Invoice #INV-2026-004",
            senderName: "Apex Solutions",
            senderEmail: "advisory@apexdigital.com",
            senderAddress: "742 Evergreen Terrace, Suite 100",
            clientName: "Global Venture Partners",
            clientAddress: "500 Financial Way, Chicago, IL",
            taxRate: 5,
            discount: 0,
            notes: "Cloud Migration Strategy & Architecture Review.\nPayment Terms: Net 30 days.",
            items: [
                { description: 'Cloud Migration Strategy & Security Audit', quantity: 1, rate: 1200 },
                { description: 'Kubernetes Cluster Provisioning & CI/CD Setup', quantity: 1, rate: 600 }
            ]
        },
        blank: {
            subject: "Invoice from Apex Digital Studio",
            senderName: "Apex Digital Studio",
            senderEmail: "billing@apexdigital.com",
            senderAddress: "",
            clientName: "",
            clientAddress: "",
            taxRate: 0,
            discount: 0,
            notes: "Payment Terms: Due upon receipt.",
            items: [
                { description: 'Service / Deliverable Description', quantity: 1, rate: 100 }
            ]
        }
    };

    // --- DOM ELEMENTS ---
    const modeBtnInvoice = document.getElementById('mode-btn-invoice');
    const modeBtnStandard = document.getElementById('mode-btn-standard');
    const invoiceModeFields = document.getElementById('invoice-mode-fields');
    const standardModeFields = document.getElementById('standard-mode-fields');
    const composerHeading = document.getElementById('composer-heading');
    const composerSubheading = document.getElementById('composer-subheading');
    const composerBubbleIcon = document.getElementById('composer-bubble-icon');
    const btnSubmitLabel = document.getElementById('btn-submit-label');

    // Form & Inputs
    const form = document.getElementById('email-form');
    const btnSubmit = document.getElementById('btn-submit') || document.getElementById('btn-submit-trigger');
    const btnReset = document.getElementById('btn-reset');
    const templateSelect = document.getElementById('template-select');
    const templateStyleSelect = document.getElementById('template-style-select');
    const fsTemplateInput = document.getElementById('fs-template');
    const emailExtraCcInput = document.getElementById('email-extra-cc');
    const emailBccInput = document.getElementById('email-bcc');
    const fileInput = document.getElementById('file-attachment');
    const fileLabelText = document.getElementById('file-label-text');
    const accordionBtn = document.getElementById('accordion-btn');
    const accordion = document.getElementById('advanced-accordion');
    const subjectCount = document.getElementById('subject-count');
    const btnSaveDefaultRecipient = document.getElementById('btn-save-default-recipient');

    if (btnSubmit) {
        btnSubmit.addEventListener('click', (e) => {
            if (btnSubmit.type !== 'submit') {
                e.preventDefault();
                if (form) {
                    form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                }
            }
        });
    }

    // Invoice Mode Inputs
    const invNumberInput = document.getElementById('inv-number');
    const invCurrencySelect = document.getElementById('inv-currency');
    const clientNameInput = document.getElementById('client-name');
    const recipientEmailInput = document.getElementById('recipient-email');
    const clientAddressInput = document.getElementById('client-address');
    const senderNameInput = document.getElementById('sender-name');
    const senderEmailInput = document.getElementById('sender-email');
    const senderAddressInput = document.getElementById('sender-address');
    const emailSubjectInput = document.getElementById('email-subject');
    const lineItemsTbody = document.getElementById('line-items-tbody');
    const btnAddItem = document.getElementById('btn-add-item');
    const invNotesInput = document.getElementById('inv-notes');
    const invTaxRateInput = document.getElementById('inv-tax-rate');
    const invDiscountInput = document.getElementById('inv-discount');
    const contactNumberInput = document.getElementById('contact-number');
    const productNameInput = document.getElementById('product-name');

    // Calculation display elements
    const calcSubtotal = document.getElementById('calc-subtotal');
    const calcTax = document.getElementById('calc-tax');
    const calcDiscount = document.getElementById('calc-discount');
    const calcGrandTotal = document.getElementById('calc-grand-total');

    // Standard Mode Inputs
    const stdRecipientEmail = document.getElementById('std-recipient-email');
    const stdSenderName = document.getElementById('std-sender-name');
    const stdSenderEmail = document.getElementById('std-sender-email');
    const stdEmailSubject = document.getElementById('std-email-subject');
    const stdEmailMessage = document.getElementById('std-email-message');

    // History & Guide
    const btnHistoryToggle = document.getElementById('btn-history-toggle');
    const historyDrawer = document.getElementById('history-drawer');
    const drawerOverlay = document.getElementById('drawer-overlay');
    const btnCloseDrawer = document.getElementById('btn-close-drawer');
    const btnClearHistory = document.getElementById('btn-clear-history');
    const historyList = document.getElementById('history-list');
    const historyEmpty = document.getElementById('history-empty');
    const historyBadge = document.getElementById('history-badge');
    const btnGuide = document.getElementById('btn-guide');
    const guideModal = document.getElementById('guide-modal');
    const modalBackdrop = document.getElementById('modal-backdrop');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnGotIt = document.getElementById('btn-got-it');

    // --- INITIALIZATION ---
    function init() {
        // Load saved default recipient
        const savedRecipient = localStorage.getItem(STORAGE_KEYS.DEFAULT_RECIPIENT);
        if (savedRecipient) {
            recipientEmailInput.value = savedRecipient;
            if (stdRecipientEmail) stdRecipientEmail.value = savedRecipient;
        }

        // Render initial line items
        renderLineItems();

        // Render Sent History
        renderHistory();

        // Calculate and update Preview
        updateInvoiceCalculations();

        if (window.lucide) lucide.createIcons();
    }

    // --- CURRENCY HELPER ---
    function getCurrencyInfo() {
        const val = invCurrencySelect.value || 'USD|$';
        const [code, symbol] = val.split('|');
        return { code, symbol: symbol || '$' };
    }

    function formatMoney(amount) {
        const { symbol } = getCurrencyInfo();
        const num = isNaN(amount) ? 0 : Number(amount);
        return `${symbol}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    // --- LINE ITEMS MANAGEMENT ---
    function renderLineItems() {
        lineItemsTbody.innerHTML = '';

        lineItems.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.className = 'item-row';
            const lineTotal = (item.quantity || 0) * (item.rate || 0);

            tr.innerHTML = `
        <td>
          <input type="text" class="form-input item-desc-input" placeholder="Service or product description" value="${escapeHtml(item.description)}" data-index="${index}" data-field="description">
        </td>
        <td>
          <input type="number" class="form-input item-qty-input text-mono" min="1" value="${item.quantity}" data-index="${index}" data-field="quantity">
        </td>
        <td>
          <input type="number" class="form-input item-rate-input text-mono" min="0" step="10" value="${item.rate}" data-index="${index}" data-field="rate">
        </td>
        <td class="item-line-total text-mono">
          ${formatMoney(lineTotal)}
        </td>
        <td class="text-center">
          <button type="button" class="btn-icon-del" data-index="${index}" title="Remove item" ${lineItems.length <= 1 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}>
            &times;
          </button>
        </td>
      `;

            lineItemsTbody.appendChild(tr);
        });

        if (window.lucide) lucide.createIcons();

        // Input listeners in rows
        lineItemsTbody.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.index, 10);
                const field = e.target.dataset.field;
                let val = e.target.value;

                if (field === 'quantity') {
                    val = parseInt(val, 10) || 0;
                } else if (field === 'rate') {
                    val = parseFloat(val) || 0;
                }

                lineItems[idx][field] = val;

                const row = e.target.closest('tr');
                const rowTotal = (lineItems[idx].quantity || 0) * (lineItems[idx].rate || 0);
                row.querySelector('.item-line-total').textContent = formatMoney(rowTotal);

                updateInvoiceCalculations();
            });
        });

        // Delete listeners
        lineItemsTbody.querySelectorAll('.btn-icon-del').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.dataset.index, 10);
                if (lineItems.length > 1) {
                    lineItems.splice(idx, 1);
                    renderLineItems();
                    updateInvoiceCalculations();
                }
            });
        });
    }

    btnAddItem.addEventListener('click', () => {
        lineItems.push({ description: 'New Service Item', quantity: 1, rate: 100 });
        renderLineItems();
        updateInvoiceCalculations();
    });

    // --- CALCULATION ENGINE & PREVIEW SYNC ---
    function calculateSubtotal() {
        return lineItems.reduce((sum, it) => sum + ((it.quantity || 0) * (it.rate || 0)), 0);
    }

    function updateInvoiceCalculations() {
        if (productNameInput && lineItems[0]) {
            lineItems[0].description = productNameInput.value.trim() || 'Service';
        }
        const subtotal = calculateSubtotal();
        const taxRate = parseFloat(invTaxRateInput.value) || 0;
        const taxAmount = (subtotal * taxRate) / 100;
        const discount = parseFloat(invDiscountInput.value) || 0;
        const grandTotal = Math.max(0, subtotal + taxAmount - discount);

        calcSubtotal.textContent = formatMoney(subtotal);
        calcTax.textContent = formatMoney(taxAmount);
        calcDiscount.textContent = `-${formatMoney(discount)}`;
        calcGrandTotal.textContent = formatMoney(grandTotal);

        const invNum = invNumberInput.value.trim() || 'INV-2026-001';
        const clientName = clientNameInput.value.trim() || 'Client / Company Name';
        const clientEmail = recipientEmailInput.value.trim() || 'client@example.com';
        const clientAddr = clientAddressInput.value.trim() || 'Billing Address';
        const senderName = senderNameInput.value.trim() || 'Apex Digital Studio';
        const senderEmail = senderEmailInput.value.trim() || 'billing@apexdigital.com';
        const senderAddr = senderAddressInput.value.trim() || 'Your Business Address';
        subjectCount.textContent = `${emailSubjectInput.value.length}/100`;
    }

    // Intelligent Name Extraction from Email (e.g. tuhin.thakur1233@gmail.com -> Tuhin Thakur)
    function extractNameFromEmail(email) {
        if (!email || typeof email !== 'string' || !email.includes('@')) return '';
        let user = email.split('@')[0].trim();

        // Strip numbers (e.g. tuhin.thakur1233 -> tuhin.thakur)
        user = user.replace(/\d+/g, '');

        // Replace dots, underscores, dashes, pluses with spaces
        user = user.replace(/[._\-+]+/g, ' ').trim();

        // Fallback if email username was only numbers
        if (!user) {
            user = email.split('@')[0].replace(/[._\-+]+/g, ' ').trim();
        }

        // Capitalize each word (Title Case)
        const words = user
            .split(/\s+/)
            .filter(Boolean)
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

        return words.join(' ') || 'Client';
    }

    // Auto-extract client name when recipient email is entered
    let clientNameManuallyEdited = false;
    if (clientNameInput) {
        clientNameInput.addEventListener('input', () => {
            clientNameManuallyEdited = clientNameInput.value.trim().length > 0;
        });
    }

    if (recipientEmailInput) {
        const handleEmailNameExtraction = () => {
            const email = recipientEmailInput.value.trim();
            if (email && (!clientNameInput.value.trim() || !clientNameManuallyEdited)) {
                const extracted = extractNameFromEmail(email);
                if (extracted) {
                    clientNameInput.value = extracted;
                    clearFieldError(clientNameInput);
                    updateInvoiceCalculations();
                }
            }
        };

        recipientEmailInput.addEventListener('input', handleEmailNameExtraction);
        recipientEmailInput.addEventListener('change', handleEmailNameExtraction);
        recipientEmailInput.addEventListener('paste', () => setTimeout(handleEmailNameExtraction, 50));
    }

    // --- INPUT LISTENERS ---
    const invoiceInputElements = [
        invNumberInput, invCurrencySelect,
        clientNameInput, recipientEmailInput, clientAddressInput,
        senderNameInput, senderEmailInput, senderAddressInput,
        emailSubjectInput, invNotesInput, invTaxRateInput, invDiscountInput, emailExtraCcInput, contactNumberInput, productNameInput
    ];

    invoiceInputElements.forEach(el => {
        if (el) {
            el.addEventListener('input', () => {
                clearFieldError(el);
                updateInvoiceCalculations();
            });
            el.addEventListener('change', () => {
                clearFieldError(el);
                updateInvoiceCalculations();
            });
        }
    });

    [stdRecipientEmail, stdSenderName, stdSenderEmail, stdEmailSubject, stdEmailMessage].forEach(el => {
        if (el) {
            el.addEventListener('input', () => {
                clearFieldError(el);
                updateInvoiceCalculations();
            });
        }
    });

    templateStyleSelect.addEventListener('change', () => {
        fsTemplateInput.value = templateStyleSelect.value;
        updateInvoiceCalculations();
    });

    // Mode Switcher (if present)
    if (modeBtnInvoice) modeBtnInvoice.addEventListener('click', () => setMode('invoice'));
    if (modeBtnStandard) modeBtnStandard.addEventListener('click', () => setMode('standard'));

    function setMode(mode) {
        currentMode = 'invoice';
        if (invoiceModeFields) invoiceModeFields.style.display = 'grid';
        if (standardModeFields) standardModeFields.style.display = 'none';
        if (btnSubmitLabel) btnSubmitLabel.textContent = 'Send Invoice via FormSubmit';
        updateInvoiceCalculations();
    }

    // Presets (if present)
    if (templateSelect) {
        templateSelect.addEventListener('change', (e) => {
            const key = e.target.value;
            if (INVOICE_PRESETS[key]) {
                const p = INVOICE_PRESETS[key];
                emailSubjectInput.value = p.subject;
                senderNameInput.value = p.senderName;
                senderEmailInput.value = p.senderEmail;
                senderAddressInput.value = p.senderAddress;
                if (p.clientName) clientNameInput.value = p.clientName;
                if (p.clientAddress) clientAddressInput.value = p.clientAddress;
                invTaxRateInput.value = p.taxRate;
                invDiscountInput.value = p.discount;
                invNotesInput.value = p.notes;
                lineItems = JSON.parse(JSON.stringify(p.items));

                renderLineItems();
                updateInvoiceCalculations();
                showToast('info', 'Preset Loaded', `Applied "${templateSelect.options[templateSelect.selectedIndex].text}"`);
            }
        });
    }

    btnSaveDefaultRecipient.addEventListener('click', () => {
        const email = recipientEmailInput.value.trim();
        if (!email || !isValidEmail(email)) {
            setFieldError(recipientEmailInput, 'Enter a valid client email to bookmark.');
            return;
        }
        localStorage.setItem(STORAGE_KEYS.DEFAULT_RECIPIENT, email);
        showToast('success', 'Default Saved', `${email} bookmarked as default.`);
    });

    accordionBtn.addEventListener('click', () => {
        const isOpen = accordion.classList.toggle('open');
        accordionBtn.setAttribute('aria-expanded', isOpen);
    });

    btnReset.addEventListener('click', () => {
        form.reset();
        lineItems = [{ description: 'Service', quantity: 1, rate: 499 }];
        renderLineItems();
        const savedRecipient = localStorage.getItem(STORAGE_KEYS.DEFAULT_RECIPIENT);
        if (savedRecipient) {
            recipientEmailInput.value = savedRecipient;
        }
        clearAllErrors();
        updateInvoiceCalculations();
        showToast('info', 'Form Reset', 'All fields have been reset.');
    });

    const attachmentStatusBadge = document.getElementById('attachment-status-badge');
    const btnClearFile = document.getElementById('btn-clear-file');
    const btnDownloadPdf = document.getElementById('btn-download-pdf');

    // --- IMAGE 1 PDF INVOICE GENERATOR & TEMPLATE POPULATOR ---
    // `overrides` lets each recipient get their own PDF (their name + email)
    // when dispatching to multiple addresses.
    function populatePdfTemplate(overrides) {
        const template = document.getElementById('invoice-pdf-template');
        if (!template) return;

        const ov = overrides || {};

        if (productNameInput && lineItems[0]) {
            lineItems[0].description = productNameInput.value.trim() || 'Service';
        }
        const subtotal = calculateSubtotal();
        const taxRate = parseFloat(invTaxRateInput.value) || 0;
        const taxAmount = (subtotal * taxRate) / 100;
        const discount = parseFloat(invDiscountInput.value) || 0;
        const grandTotal = Math.max(0, subtotal + taxAmount - discount);
        const invNum = invNumberInput.value.trim() || 'INV-2026-001';
        const senderName = senderNameInput.value.trim() || 'YOUR COMPANY';
        const senderEmail = senderEmailInput.value.trim() || 'billing@apexdigital.com';
        const senderAddress = senderAddressInput.value.trim() || '1331 Hart Ridge Road, 48436 Gaines, MI';
        const clientName = ov.clientName || clientNameInput.value.trim() || 'JOHN SMITH';
        const clientEmail = ov.clientEmail || recipientEmailInput.value.trim() || 'client@example.com';
        const clientAddress = clientAddressInput.value.trim() || '4504 Liberty Avenue, 92680 Tustin, CA';
        const notes = invNotesInput.value.trim() || 'If you did not make this payment, please contact our billing support team';

        // Populate Sender Info
        const pdfSenderName = document.getElementById('pdf-sender-name');
        const pdfSenderAddress = document.getElementById('pdf-sender-address');
        const pdfSenderEmail = document.getElementById('pdf-sender-email');

        if (pdfSenderName) pdfSenderName.textContent = senderName;
        if (pdfSenderAddress) pdfSenderAddress.innerHTML = escapeHtml(senderAddress).replace(/\n/g, '<br>');
        if (pdfSenderEmail) pdfSenderEmail.textContent = senderEmail;

        // Contact number from the form — hide the whole line when it's blank so the
        // invoice never ships a placeholder number.
        const contactNumber = contactNumberInput ? contactNumberInput.value.trim() : '';
        const pdfSenderPhone = document.getElementById('pdf-sender-phone');
        const pdfSenderPhoneWrap = document.getElementById('pdf-sender-phone-wrap');
        if (pdfSenderPhone) pdfSenderPhone.textContent = contactNumber;
        if (pdfSenderPhoneWrap) pdfSenderPhoneWrap.style.display = contactNumber ? 'block' : 'none';

        const pdfMetaContact = document.getElementById('pdf-meta-contact');
        const pdfMetaContactRow = document.getElementById('pdf-meta-contact-row');
        if (pdfMetaContact) pdfMetaContact.textContent = contactNumber;
        if (pdfMetaContactRow) pdfMetaContactRow.style.display = contactNumber ? 'flex' : 'none';

        // Populate Recipient Info
        const pdfClientName = document.getElementById('pdf-client-name');
        const pdfClientAddress = document.getElementById('pdf-client-address');
        const pdfClientEmail = document.getElementById('pdf-client-email');

        if (pdfClientName) pdfClientName.textContent = clientName;
        if (pdfClientAddress) pdfClientAddress.innerHTML = escapeHtml(clientAddress).replace(/\n/g, '<br>');
        if (pdfClientEmail) pdfClientEmail.textContent = clientEmail;

        // Populate Metadata
        const pdfInvNumber = document.getElementById('pdf-inv-number');
        const pdfInvDate = document.getElementById('pdf-inv-date');
        if (pdfInvNumber) pdfInvNumber.textContent = invNum;
        if (pdfInvDate) {
            const today = new Date();
            const formattedDate = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            pdfInvDate.textContent = formattedDate;
        }

        // Populate Table Rows
        const tbody = document.getElementById('pdf-items-tbody');
        if (tbody) {
            tbody.innerHTML = '';
            lineItems.forEach(it => {
                const tr = document.createElement('tr');
                tr.style.borderBottom = '1px solid #f8fafc';
                const rowTotal = (it.quantity || 0) * (it.rate || 0);
                tr.innerHTML = `
                    <td style="padding: 10px 6px; font-size: 12px; color: #334155;">${escapeHtml(it.description)}</td>
                    <td style="padding: 10px 6px; font-size: 12px; color: #475569; text-align: center;">${it.quantity}</td>
                    <td style="padding: 10px 6px; font-size: 12px; color: #475569; text-align: right;">${formatMoney(it.rate)}</td>
                    <td style="padding: 10px 6px; font-size: 12px; color: #334155; font-weight: 500; text-align: right;">${formatMoney(rowTotal)}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        // Populate Notes
        const pdfNotes = document.getElementById('pdf-notes');
        if (pdfNotes) pdfNotes.textContent = notes;

        // Populate Totals
        const pdfSubtotal = document.getElementById('pdf-subtotal');
        const pdfDiscountRow = document.getElementById('pdf-discount-row');
        const pdfDiscountVal = document.getElementById('pdf-discount-val');
        const pdfTaxRow = document.getElementById('pdf-tax-row');
        const pdfTaxLabel = document.getElementById('pdf-tax-label');
        const pdfTaxVal = document.getElementById('pdf-tax-val');
        const pdfTotal = document.getElementById('pdf-total');

        if (pdfSubtotal) pdfSubtotal.textContent = formatMoney(subtotal);

        if (pdfDiscountRow) {
            if (discount > 0) {
                pdfDiscountRow.style.display = 'flex';
                if (pdfDiscountVal) pdfDiscountVal.textContent = `-${formatMoney(discount)}`;
            } else {
                pdfDiscountRow.style.display = 'none';
            }
        }

        if (pdfTaxRow) {
            if (taxRate > 0) {
                pdfTaxRow.style.display = 'flex';
                if (pdfTaxLabel) pdfTaxLabel.textContent = `TAX (${taxRate}%)`;
                if (pdfTaxVal) pdfTaxVal.textContent = formatMoney(taxAmount);
            } else {
                pdfTaxRow.style.display = 'none';
            }
        }

        if (pdfTotal) pdfTotal.textContent = formatMoney(grandTotal);
    }

    function pdfLibsReady() {
        return !!(window.html2canvas && window.jspdf && window.jspdf.jsPDF);
    }

    // The template is parked off-screen (left: -10000px) so it never flashes on the
    // page, but html2canvas sizes its capture window from the element's on-page rect.
    // Pin the capture box to the element's own dimensions and pull the *clone* back
    // into normal flow, or the canvas comes back empty.
    async function renderInvoiceCanvas(overrides) {
        populatePdfTemplate(overrides);
        const element = document.getElementById('invoice-pdf-template');
        if (!element || !window.html2canvas) return null;

        return await html2canvas(element, {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            width: element.offsetWidth,
            height: element.offsetHeight,
            windowWidth: element.offsetWidth,
            windowHeight: element.offsetHeight,
            scrollX: 0,
            scrollY: 0,
            onclone: (clonedDoc) => {
                const clone = clonedDoc.getElementById('invoice-pdf-template');
                if (!clone) return;
                clone.style.position = 'static';
                clone.style.left = '0';
                clone.style.top = '0';
                clone.style.zIndex = 'auto';
            }
        });
    }

    function canvasToPdf(canvas) {
        const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const margin = 8;
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pageWidth - margin * 2;
        const imgHeight = Math.min((canvas.height / canvas.width) * imgWidth, pageHeight - margin * 2);

        pdf.addImage(canvas.toDataURL('image/jpeg', 0.98), 'JPEG', margin, margin, imgWidth, imgHeight);
        return pdf;
    }

    async function generateInvoicePdfBlob(overrides) {
        if (!pdfLibsReady()) return null;
        const canvas = await renderInvoiceCanvas(overrides);
        if (!canvas) return null;
        return canvasToPdf(canvas).output('blob');
    }

    async function downloadInvoicePdf() {
        const invNum = invNumberInput.value.trim() || 'INV-2026-001';

        if (!pdfLibsReady()) {
            showToast('error', 'Loading Library', 'PDF generator is initializing. Please try again.');
            return;
        }

        try {
            showToast('info', 'Generating PDF...', 'Preparing your high-resolution invoice PDF.');
            const canvas = await renderInvoiceCanvas();
            if (!canvas) throw new Error('Could not render invoice template.');
            canvasToPdf(canvas).save(`${invNum}.pdf`);
            showToast('success', 'PDF Downloaded', `${invNum}.pdf has been saved.`);
        } catch (err) {
            console.error('PDF download error:', err);
            showToast('error', 'Download Failed', 'Could not generate PDF.');
        }
    }

    if (btnDownloadPdf) {
        btnDownloadPdf.addEventListener('click', downloadInvoicePdf);
    }

    function resetFileInput() {
        if (fileInput) fileInput.value = '';
        if (fileLabelText) fileLabelText.textContent = 'Auto-attaching Image 1 PDF (or click to upload image/PDF)';
        if (attachmentStatusBadge) {
            attachmentStatusBadge.textContent = 'Auto-generates PDF';
            attachmentStatusBadge.style.background = 'rgba(59, 130, 246, 0.16)';
            attachmentStatusBadge.style.color = 'var(--blue-light)';
        }
        if (btnClearFile) btnClearFile.style.display = 'none';
    }

    if (fileInput) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files && fileInput.files[0]) {
                const file = fileInput.files[0];
                if (file.size > 25 * 1024 * 1024) {
                    showToast('error', 'File Too Large', 'Maximum attachment size is 25MB.');
                    resetFileInput();
                } else {
                    fileLabelText.textContent = `📎 ${file.name} (${formatFileSize(file.size)})`;
                    if (attachmentStatusBadge) {
                        attachmentStatusBadge.textContent = 'Custom File Attached';
                        attachmentStatusBadge.style.background = 'rgba(16, 185, 129, 0.2)';
                        attachmentStatusBadge.style.color = '#34d399';
                    }
                    if (btnClearFile) btnClearFile.style.display = 'inline-block';
                    showToast('info', 'File Attached', `${file.name} will be dispatched.`);
                }
            } else {
                resetFileInput();
            }
            updateInvoiceCalculations();
        });
    }

    if (btnClearFile) {
        btnClearFile.addEventListener('click', (e) => {
            e.stopPropagation();
            resetFileInput();
            showToast('info', 'Auto PDF Restored', 'The email will now auto-generate and attach the Image 1 PDF invoice.');
            updateInvoiceCalculations();
        });
    }

    // Modals & Drawers
    btnGuide.addEventListener('click', () => openModal(guideModal));
    btnCloseModal.addEventListener('click', () => closeModal(guideModal));
    btnGotIt.addEventListener('click', () => closeModal(guideModal));
    modalBackdrop.addEventListener('click', () => closeModal(guideModal));

    // --- MAIN EMAIL (FormSubmit router) EDITOR ---
    const btnEditRouter = document.getElementById('btn-edit-router');
    const routerModal = document.getElementById('router-modal');
    const btnCloseRouter = document.getElementById('btn-close-router');
    const routerForm = document.getElementById('router-form');
    const routerEmailInput = document.getElementById('router-email-input');
    const routerEmailLabel = document.getElementById('router-email-label');
    const routerError = document.getElementById('router-error');

    function refreshRouterLabel() {
        if (routerEmailLabel) routerEmailLabel.textContent = PRIMARY_ROUTER_EMAIL;
        if (btnEditRouter) btnEditRouter.title = `Main FormSubmit email: ${PRIMARY_ROUTER_EMAIL} (click to change)`;
    }
    refreshRouterLabel();

    if (btnEditRouter) {
        btnEditRouter.addEventListener('click', () => {
            routerError.textContent = '';
            routerEmailInput.value = PRIMARY_ROUTER_EMAIL;
            routerModal.hidden = false;
            routerEmailInput.focus();
        });
    }
    function closeRouterModal() { if (routerModal) routerModal.hidden = true; }
    if (btnCloseRouter) btnCloseRouter.addEventListener('click', closeRouterModal);
    if (routerModal) routerModal.addEventListener('click', (e) => { if (e.target === routerModal) closeRouterModal(); });

    if (routerForm) {
        routerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const val = routerEmailInput.value.trim().toLowerCase();
            if (!val || !isValidEmail(val)) {
                routerError.textContent = 'Please enter a valid email address.';
                return;
            }
            PRIMARY_ROUTER_EMAIL = val;
            try { localStorage.setItem(ROUTER_STORAGE_KEY, val); } catch (err) { /* ignore */ }
            refreshRouterLabel();
            closeRouterModal();
            showToast('success', 'Main Email Updated', `Invoices now dispatch through <strong>${val}</strong>. Activate it once via the FormSubmit email if you haven\'t.`);
        });
    }

    btnHistoryToggle.addEventListener('click', () => openDrawer(historyDrawer));
    btnCloseDrawer.addEventListener('click', () => closeDrawer(historyDrawer));
    drawerOverlay.addEventListener('click', () => closeDrawer(historyDrawer));
    btnClearHistory.addEventListener('click', () => {
        localStorage.removeItem(STORAGE_KEYS.HISTORY);
        renderHistory();
        showToast('info', 'History Cleared', 'Sent logs cleared.');
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal(guideModal);
            closeDrawer(historyDrawer);
        }
    });

    // --- FORM SUBMISSION (FORMSUBMIT AJAX) ---
    async function handleFormSubmit(e) {
        if (e) e.preventDefault();
        clearAllErrors();

        let isValid = true;
        const recipientEmails = extractEmails(recipientEmailInput.value.trim());
        const senderName = senderNameInput.value.trim() || 'Apex Digital Studio';
        const senderEmail = senderEmailInput.value.trim() || PRIMARY_ROUTER_EMAIL;
        let clientName = clientNameInput.value.trim();
        const subject = emailSubjectInput.value.trim() || `Invoice #${invNumberInput.value.trim() || 'INV-001'} from ${senderName}`;

        if (recipientEmails.length === 0) {
            setFieldError(recipientEmailInput, 'Please enter at least one recipient email address.');
            isValid = false;
        }

        if (!clientName && recipientEmails.length > 0) {
            clientName = recipientEmails.length > 1
                ? `${extractNameFromEmail(recipientEmails[0])} (+${recipientEmails.length - 1} others)`
                : extractNameFromEmail(recipientEmails[0]);
            clientNameInput.value = clientName;
        }

        if (!clientName) {
            setFieldError(clientNameInput, 'Client name is required.');
            isValid = false;
        }

        if (!senderEmail || !isValidEmail(senderEmail)) {
            setFieldError(senderEmailInput, 'Please enter a valid sender email.');
            isValid = false;
        }

        if (!isValid) {
            showToast('error', 'Validation Error', 'Please check the highlighted fields.');
            return;
        }

        setSubmittingState(true);

        if (productNameInput && lineItems[0]) {
            lineItems[0].description = productNameInput.value.trim() || 'Service';
        }

        const btnSubmitLoaderText = document.getElementById('btn-submit-loader-text');
        const subtotal = calculateSubtotal();
        const taxRate = parseFloat(invTaxRateInput.value) || 0;
        const taxAmount = (subtotal * taxRate) / 100;
        const discount = parseFloat(invDiscountInput.value) || 0;
        const grandTotal = Math.max(0, subtotal + taxAmount - discount);
        const invNum = invNumberInput.value.trim() || 'INV-2026-001';
        const extraCc = emailExtraCcInput ? emailExtraCcInput.value.trim() : '';
        const contactNumber = contactNumberInput ? contactNumberInput.value.trim() : '';

        const productName = productNameInput ? (productNameInput.value.trim() || 'Service') : 'Service';

        const hasManualFile = fileInput && fileInput.files && fileInput.files.length > 0;

        try {
            let successCount = 0;

            for (let i = 0; i < recipientEmails.length; i++) {
                const currentEmail = recipientEmails[i];
                const currentClientName = extractNameFromEmail(currentEmail);

                // Each recipient gets their own PDF, addressed to their name/email.
                let recipientPdfBlob = null;
                if (!hasManualFile) {
                    if (btnSubmitLoaderText) {
                        btnSubmitLoaderText.textContent = recipientEmails.length > 1
                            ? `Generating PDF [${i + 1}/${recipientEmails.length}]...`
                            : 'Generating invoice PDF...';
                    }
                    try {
                        recipientPdfBlob = await generateInvoicePdfBlob({
                            clientName: currentClientName,
                            clientEmail: currentEmail
                        });
                    } catch (pdfErr) {
                        console.warn('Auto PDF generation warning:', pdfErr);
                    }
                }

                if (btnSubmitLoaderText) {
                    btnSubmitLoaderText.textContent = recipientEmails.length > 1
                        ? `Dispatching [${i + 1}/${recipientEmails.length}]...`
                        : `Dispatching...`;
                }

                let fullCc = currentEmail;
                if (extraCc) fullCc += `, ${extraCc}`;

                const formData = new FormData();
                formData.append('_cc', fullCc);
                formData.append('_subject', subject);
                formData.append('_replyto', senderEmail);
                formData.append('_captcha', 'false');
                formData.append('_template', (templateStyleSelect && templateStyleSelect.value) ? templateStyleSelect.value : 'table');
                formData.append('Invoice_Number', invNum);
                formData.append('Billed_To', `${currentClientName} <${currentEmail}>`);
                formData.append('Billed_From', `${senderName} <${senderEmail}>`);
                formData.append('Product', productName);
                formData.append('Total', formatMoney(grandTotal));
                formData.append('Contact_Us', contactNumber ? `For any questions regarding this invoice, contact us at ${contactNumber}.` : 'For any questions regarding this invoice, please contact us.');
                if (emailBccInput && emailBccInput.value.trim()) formData.append('_bcc', emailBccInput.value.trim());

                if (hasManualFile) {
                    formData.append('attachment', fileInput.files[0]);
                } else if (recipientPdfBlob) {
                    formData.append('attachment', recipientPdfBlob, `${invNum}.pdf`);
                }

                const response = await fetch(getFormSubmitEndpoint(), {
                    method: 'POST',
                    headers: { 'Accept': 'application/json' },
                    body: formData
                });

                let data = {};
                let parsedJson = true;
                try {
                    data = await response.json();
                } catch (parseErr) {
                    parsedJson = false;
                }

                if (response.ok && (parsedJson === false || data.success === 'true' || data.success === true || response.status === 200)) {
                    successCount++;
                    saveToHistory({
                        to: `${currentClientName} <${currentEmail}>`,
                        fromName: senderName,
                        fromEmail: senderEmail,
                        subject: subject,
                        amount: formatMoney(grandTotal),
                        invNumber: invNum,
                        timestamp: new Date().toISOString()
                    });
                } else if (data.message && data.message.toLowerCase().includes('activate')) {
                    showToast('info', 'Router One-Time Activation', `FormSubmit sent a 1-time activation link to <strong>${PRIMARY_ROUTER_EMAIL}</strong>. Click it once in your inbox to enable submissions.`);
                    openModal(guideModal);
                    break;
                } else {
                    const errorMsg = data.message || `FormSubmit returned status ${response.status}.`;
                    showToast('error', `Dispatch Failed for ${currentEmail}`, errorMsg);
                }

                // Wait 1.1s between sequential sends if multiple recipients
                if (i < recipientEmails.length - 1) {
                    await new Promise(r => setTimeout(r, 1100));
                }
            }

            if (successCount > 0) {
                triggerConfetti();
                showToast('success', 'Invoice Dispatched!', `Delivered invoice to <strong>${successCount}</strong> recipient${successCount === 1 ? '' : 's'} via FormSubmit CC!`);
            }

        } catch (err) {
            console.error('Submission error:', err);
            showToast('error', 'Network Error', 'Unable to reach FormSubmit.co. Please check your internet connection.');
        } finally {
            setSubmittingState(false);
        }
    }

    // #btn-submit is type="submit", so the form's submit event is the single entry point.
    // Binding a click handler as well would fire two concurrent dispatch loops.
    if (form) form.addEventListener('submit', handleFormSubmit);

    // --- HELPERS ---
    function isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        else return (bytes / 1048576).toFixed(1) + ' MB';
    }

    function setFieldError(inputEl, message) {
        inputEl.classList.add('is-invalid');
        const errorEl = document.getElementById(`${inputEl.id}-error`);
        if (errorEl) {
            errorEl.textContent = message;
        }
    }

    function clearFieldError(inputEl) {
        inputEl.classList.remove('is-invalid');
        const errorEl = document.getElementById(`${inputEl.id}-error`);
        if (errorEl) {
            errorEl.textContent = '';
        }
    }

    function clearAllErrors() {
        document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
        document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
    }

    function setSubmittingState(isSubmitting) {
        if (!btnSubmit) return;
        const btnText = btnSubmit.querySelector('.btn-text');
        const btnLoader = btnSubmit.querySelector('.btn-loader');

        btnSubmit.disabled = isSubmitting;
        if (btnText) btnText.style.display = isSubmitting ? 'none' : 'inline-flex';
        if (btnLoader) btnLoader.style.display = isSubmitting ? 'inline-flex' : 'none';
    }

    function openModal(modal) { if (modal) modal.classList.add('open'); }
    function closeModal(modal) { if (modal) modal.classList.remove('open'); }
    function openDrawer(drawer) { if (drawer) drawer.classList.add('open'); }
    function closeDrawer(drawer) { if (drawer) drawer.classList.remove('open'); }

    // --- MULTI-EMAIL MODAL & SAVE HANDLERS ---
    const btnOpenBatchModal = document.getElementById('btn-open-batch-modal');
    const batchModal = document.getElementById('batch-modal');
    const batchModalBackdrop = document.getElementById('batch-modal-backdrop');
    const btnCloseBatchModal = document.getElementById('btn-close-batch-modal');
    const btnCancelBatch = document.getElementById('btn-cancel-batch');
    const btnSaveBatch = document.getElementById('btn-save-batch');
    const batchEmailsTextarea = document.getElementById('batch-emails-textarea');
    const batchEmailCountBadge = document.getElementById('batch-email-count-badge');

    function extractEmails(text) {
        if (!text) return [];
        const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
        return [...new Set(matches.map(e => e.trim().toLowerCase()))];
    }

    function syncBatchButtonAndLabel() {
        const emails = extractEmails(recipientEmailInput.value);
        if (emails.length > 1) {
            if (btnOpenBatchModal) btnOpenBatchModal.innerHTML = `✓ ${emails.length} Emails Configured`;
            if (btnSubmitLabel) btnSubmitLabel.textContent = `Send Invoice (${emails.length} Recipients)`;
        } else {
            if (btnOpenBatchModal) btnOpenBatchModal.innerHTML = `+ Multiple Emails`;
            if (btnSubmitLabel) btnSubmitLabel.textContent = `Send Invoice via FormSubmit`;
        }
    }

    if (recipientEmailInput) {
        recipientEmailInput.addEventListener('input', syncBatchButtonAndLabel);
        recipientEmailInput.addEventListener('change', syncBatchButtonAndLabel);
    }

    if (btnOpenBatchModal) {
        btnOpenBatchModal.addEventListener('click', () => {
            const currentEmails = extractEmails(recipientEmailInput.value);
            if (currentEmails.length > 0) {
                batchEmailsTextarea.value = currentEmails.join('\n');
            }
            const valid = extractEmails(batchEmailsTextarea.value);
            if (batchEmailCountBadge) batchEmailCountBadge.textContent = `${valid.length} valid email${valid.length === 1 ? '' : 's'}`;
            if (btnSaveBatch) {
                btnSaveBatch.disabled = valid.length === 0;
                btnSaveBatch.innerHTML = `<span>Save Recipients (${valid.length})</span>`;
            }
            openModal(batchModal);
        });
    }

    if (batchEmailsTextarea) {
        batchEmailsTextarea.addEventListener('input', () => {
            const emails = extractEmails(batchEmailsTextarea.value);
            if (batchEmailCountBadge) batchEmailCountBadge.textContent = `${emails.length} valid email${emails.length === 1 ? '' : 's'}`;
            if (btnSaveBatch) {
                btnSaveBatch.disabled = emails.length === 0;
                btnSaveBatch.innerHTML = `<span>Save Recipients (${emails.length})</span>`;
            }
        });
    }

    if (btnSaveBatch) {
        btnSaveBatch.addEventListener('click', () => {
            const emails = extractEmails(batchEmailsTextarea.value);
            if (emails.length === 0) {
                showToast('error', 'No Recipients', 'Please enter at least one valid email address.');
                return;
            }

            if (emails.length === 1) {
                recipientEmailInput.value = emails[0];
                clientNameInput.value = extractNameFromEmail(emails[0]);
                clearFieldError(recipientEmailInput);
                clearFieldError(clientNameInput);
                syncBatchButtonAndLabel();
                closeModal(batchModal);
                showToast('success', 'Recipient Saved', `Configured <strong>${emails[0]}</strong> for dispatch.`);
            } else {
                recipientEmailInput.value = emails.join(', ');
                clientNameInput.value = `${extractNameFromEmail(emails[0])} (+${emails.length - 1} others)`;
                clearFieldError(recipientEmailInput);
                clearFieldError(clientNameInput);
                syncBatchButtonAndLabel();
                closeModal(batchModal);
                showToast('success', 'Recipients Saved', `Configured <strong>${emails.length}</strong> client emails for dispatch.`);
            }
            updateInvoiceCalculations();
        });
    }

    if (btnCloseBatchModal) btnCloseBatchModal.addEventListener('click', () => closeModal(batchModal));
    if (btnCancelBatch) btnCancelBatch.addEventListener('click', () => closeModal(batchModal));
    if (batchModalBackdrop) batchModalBackdrop.addEventListener('click', () => closeModal(batchModal));

    // --- HISTORY ---
    function getHistory() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    function saveToHistory(entry) {
        const history = getHistory();
        history.unshift(entry);
        if (history.length > 50) history.pop();
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
        renderHistory();
    }

    function renderHistory() {
        const history = getHistory();
        historyBadge.textContent = history.length;

        if (history.length === 0) {
            historyEmpty.style.display = 'flex';
            historyList.innerHTML = '';
            return;
        }

        historyEmpty.style.display = 'none';
        historyList.innerHTML = history.map((item, index) => {
            const timeStr = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
            return `
        <li class="history-item" data-index="${index}">
          <div class="history-item-top">
            <span class="history-to">To: ${escapeHtml(item.to)}</span>
            <span class="history-time">${timeStr}</span>
          </div>
          <div class="history-subject">${escapeHtml(item.subject)}</div>
          ${item.amount ? `<div class="history-amount">${escapeHtml(item.amount)}</div>` : ''}
        </li>
      `;
        }).join('');
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function triggerConfetti() {
        if (typeof confetti === 'function') {
            confetti({
                particleCount: 85,
                spread: 75,
                origin: { y: 0.65 },
                colors: ['#6366f1', '#06b6d4', '#8b5cf6', '#10b981', '#ffffff']
            });
        }
    }

    function showToast(type, title, messageHtml, duration = 5500) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        toast.innerHTML = `
      <div class="toast-content">
        <div class="toast-title">${escapeHtml(title)}</div>
        <div class="toast-message">${messageHtml}</div>
      </div>
      <div class="toast-close" title="Dismiss">&times;</div>
    `;

        container.appendChild(toast);

        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => removeToast(toast));

        const timeout = setTimeout(() => {
            removeToast(toast);
        }, duration);

        function removeToast(el) {
            clearTimeout(timeout);
            el.style.opacity = '0';
            el.style.transform = 'translateY(-10px)';
            setTimeout(() => {
                if (el.parentNode) el.parentNode.removeChild(el);
            }, 250);
        }
    }

    // Start initialization
    init();
});
