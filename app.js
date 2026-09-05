import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAJNWKpNpjYfRhEi_9TTMbFgoY35k5VRTE",
  authDomain: "allam-80a24.firebaseapp.com",
  projectId: "allam-80a24",
  storageBucket: "allam-80a24.firebasestorage.app",
  messagingSenderId: "1065398474004",
  appId: "1:1065398474004:web:298611708c34ac6f691e01",
  measurementId: "G-7M0ZLSZ6N4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Data states
let localProducts = [];
let appLogs = [];

// Fallback to localStorage initially to avoid white screen before Firebase loads
const localInv = localStorage.getItem('arzaq_inventory');
if (localInv) {
    localProducts = JSON.parse(localInv);
    let cleaned = false;
    localProducts.forEach(p => {
        if (p.name && p.name.match(/^(?:اسمه|اسمها|اسم)\s+/i)) {
            p.name = p.name.replace(/^(?:اسمه|اسمها|اسم)\s+/i, '').trim();
            cleaned = true;
        }
    });
    if (cleaned) localStorage.setItem('arzaq_inventory', JSON.stringify(localProducts));
} else {
    localProducts = [
        { id: 1, name: 'كتاوت 24 فولت', qty: 15, targetQty: 20, price: 120 },
        { id: 2, name: 'لمبة إشارة', qty: 0, targetQty: 50, price: 25 },
        { id: 3, name: 'موبينة مارش', qty: 5, targetQty: 5, price: 450 }
    ];
}

const localLg = localStorage.getItem('arzaq_logs');
if (localLg) {
    appLogs = JSON.parse(localLg);
}

// ------------------------------------------
// 1. Data Layer (Firebase Realtime Sync)
// ------------------------------------------
const inventoryDocRef = doc(db, 'inventory', 'main');
const logsDocRef = doc(db, 'inventory', 'logs');

// Listen to Firestore for Inventory
onSnapshot(inventoryDocRef, (docSnap) => {
    if (docSnap.exists()) {
        localProducts = docSnap.data().items || [];
        let cleaned = false;
        localProducts.forEach(p => {
            if (p.name && p.name.match(/^(?:اسمه|اسمها|اسم)\s+/i)) {
                p.name = p.name.replace(/^(?:اسمه|اسمها|اسم)\s+/i, '').trim();
                cleaned = true;
            }
        });
        localStorage.setItem('arzaq_inventory', JSON.stringify(localProducts)); // Backup locally
        if (cleaned) {
            setDoc(inventoryDocRef, { items: localProducts }, { merge: true });
        }
        updateUI();
    } else {
        // If Firestore is empty, initialize it with local data
        setDoc(inventoryDocRef, { items: localProducts }, { merge: true });
    }
});

// Listen to Firestore for Logs
onSnapshot(logsDocRef, (docSnap) => {
    if (docSnap.exists()) {
        appLogs = docSnap.data().items || [];
        localStorage.setItem('arzaq_logs', JSON.stringify(appLogs));
        renderLogs();
    } else {
        setDoc(logsDocRef, { items: appLogs }, { merge: true });
    }
});

function getProducts() {
    return localProducts.map(item => ({
        ...item,
        qty: parseInt(item.qty) || 0,
        targetQty: item.targetQty !== undefined ? parseInt(item.targetQty) : (item.qty > 0 ? parseInt(item.qty) : 10),
        price: item.price ? parseInt(item.price) : null
    }));
}

async function saveProducts(products) {
    localProducts = products;
    localStorage.setItem('arzaq_inventory', JSON.stringify(products));
    updateUI(); 
    try {
        await setDoc(inventoryDocRef, { items: products }, { merge: true });
    } catch(err) {
        console.error("Firebase sync error:", err);
    }
}

async function logAction(message) {
    const time = new Date().toISOString();
    appLogs.unshift({ message, time });
    if (appLogs.length > 300) appLogs = appLogs.slice(0, 300);
    localStorage.setItem('arzaq_logs', JSON.stringify(appLogs));
    renderLogs();
    try {
        await setDoc(logsDocRef, { items: appLogs }, { merge: true });
    } catch(err) {
        console.error("Firebase log sync error:", err);
    }
}

// ==========================================
// 2. DOM Elements & UI Navigation
// ==========================================
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const addForm = document.getElementById('add-form');
const inventoryBody = document.getElementById('inventory-body');
const searchInput = document.getElementById('search-input');
const shortagesList = document.getElementById('shortages-list');
const logsBody = document.getElementById('logs-body');

const totalProductsEl = document.getElementById('total-products');
const availableProductsEl = document.getElementById('available-products');
const outOfStockEl = document.getElementById('out-of-stock');
const totalValueEl = document.getElementById('total-value');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.target).classList.add('active');
        if (tab.dataset.target === 'inventory') {
            if (searchInput) searchInput.placeholder = 'ابحث عن منتج...';
            renderTable(getProducts());
        }
    });
});

// التنقل لصفحة المنتجات عند الضغط على كروت الإحصائيات (متوفرة / ناقصة / الإجمالي)
function openInventoryWithFilter(filterType = 'all') {
    tabs.forEach(t => {
        if (t.dataset.target === 'inventory') {
            t.classList.add('active');
        } else {
            t.classList.remove('active');
        }
    });
    tabContents.forEach(c => {
        if (c.id === 'inventory') {
            c.classList.add('active');
        } else {
            c.classList.remove('active');
        }
    });

    const products = getProducts();
    let filtered = products;

    if (filterType === 'available') {
        filtered = products.filter(p => p.qty > 0);
        if (searchInput) searchInput.placeholder = '🔍 المنتجات المتوفرة فقط...';
    } else if (filterType === 'shortage') {
        filtered = products.filter(p => p.qty < p.targetQty);
        if (searchInput) searchInput.placeholder = '🔍 المنتجات الناقصة فقط...';
    } else {
        if (searchInput) searchInput.placeholder = 'ابحث عن منتج...';
    }

    if (searchInput) searchInput.value = '';
    renderTable(filtered);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

const statCards = document.querySelectorAll('.stat-card');
if (statCards.length >= 4) {
    // كارت إجمالي المنتجات
    statCards[0].addEventListener('click', () => openInventoryWithFilter('all'));
    // كارت المنتجات المتوفرة
    statCards[1].addEventListener('click', () => openInventoryWithFilter('available'));
    // كارت المنتجات الناقصة (خلصانة)
    statCards[2].addEventListener('click', () => openInventoryWithFilter('shortage'));
    // كارت قيمة المخزون
    statCards[3].addEventListener('click', () => openInventoryWithFilter('all'));
}

// ==========================================
// 3. UI Render Functions
// ==========================================
function updateUI() {
    const products = getProducts();
    renderTable(products);
    updateStats(products);
    renderShortages(products);
    renderLogs();
}

function updateStats(products) {
    totalProductsEl.textContent = products.length;
    availableProductsEl.textContent = products.filter(item => item.qty > 0).length;
    outOfStockEl.textContent = products.filter(item => item.qty === 0).length;
    
    // حساب قيمة المخزون (الكمية × السعر)
    if (totalValueEl) {
        const totalValue = products.reduce((acc, item) => acc + ((item.qty || 0) * (item.price || 0)), 0);
        totalValueEl.textContent = totalValue.toLocaleString('ar-EG') + ' ج';
    }
}

function renderShortages(products) {
    shortagesList.innerHTML = '';
    const shortages = products.filter(item => item.qty < item.targetQty);
    
    if (shortages.length === 0) {
        shortagesList.innerHTML = '<p style="color: green; font-weight: bold;">✅ جميع المنتجات متوفرة بالكميات المطلوبة ولا يوجد نواقص.</p>';
        return;
    }

    shortages.forEach(item => {
        const missing = Math.max(item.targetQty - item.qty, 0);
        const isEmpty = item.qty === 0;
        
        const cardClass = isEmpty ? 'shortage-card empty' : 'shortage-card';
        const icon = isEmpty ? '❌' : '🔴';
        const statusText = isEmpty 
            ? 'المنتج خلص بالكامل' 
            : `الكمية الحالية: ${item.qty} من أصل ${item.targetQty}`;
        
        const div = document.createElement('div');
        div.className = cardClass;
        div.innerHTML = `
            <h4>${icon} ${item.name} — ناقص ${missing}</h4>
            <p>${statusText}</p>
        `;
        shortagesList.appendChild(div);
    });
}

function renderTable(products) {
    inventoryBody.innerHTML = '';
    products.forEach(item => {
        const tr = document.createElement('tr');
        
        let statusClass = 'status-available';
        let statusText = 'متوفر بالكامل';
        
        if (item.qty === 0) {
            statusClass = 'status-empty';
            statusText = 'خلصان';
        } else if (item.qty < item.targetQty) {
            statusClass = 'status-warning';
            statusText = 'ناقص';
        }
        
        tr.innerHTML = `
            <td data-label="المنتج">${item.name}</td>
            <td data-label="الكمية / المطلوب"><strong style="color:var(--primary-dark)">${item.qty}</strong> / ${item.targetQty}</td>
            <td data-label="السعر">${item.price ? item.price + ' ج' : '-'}</td>
            <td data-label="الحالة"><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td data-label="إجراءات">
                <button class="action-btn btn-edit" onclick="editQty(${item.id})"><i class="fas fa-edit"></i></button>
                <button class="action-btn btn-delete" onclick="deleteItem(${item.id})"><i class="fas fa-trash"></i></button>
            </td>
        `;
        inventoryBody.appendChild(tr);
    });
}

function renderLogs() {
    if (!logsBody) return;
    logsBody.innerHTML = '';
    if (appLogs.length === 0) {
        logsBody.innerHTML = '<tr><td colspan="2" style="text-align: center;">لا توجد حركات مسجلة حالياً.</td></tr>';
        return;
    }
    appLogs.forEach(log => {
        const tr = document.createElement('tr');
        const dateObj = new Date(log.time);
        
        // Format: اليوم 8:30 م or 5/9/2026 8:30 م
        const today = new Date();
        const isToday = dateObj.toDateString() === today.toDateString();
        const timeStr = dateObj.toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' });
        const dateStr = isToday ? `اليوم ${timeStr}` : `${dateObj.toLocaleDateString('ar-EG')} ${timeStr}`;

        tr.innerHTML = `
            <td style="color: #666; font-size: 0.95rem;">${dateStr}</td>
            <td style="font-weight: 600;">${log.message}</td>
        `;
        logsBody.appendChild(tr);
    });
}

// ==========================================
// 4. Forms & Manual Actions
// ==========================================
addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('prod-name').value;
    const qty = parseInt(document.getElementById('prod-qty').value);
    const targetQty = parseInt(document.getElementById('prod-target-qty').value);
    const price = document.getElementById('prod-price').value;

    let products = getProducts();
    products.push({
        id: Date.now(),
        name,
        qty,
        targetQty,
        price: price ? parseInt(price) : null
    });
    saveProducts(products);
    
    // Log
    logAction(`📦 تم إضافة منتج جديد: "${name}" بكمية ${qty} قطعة.`);
    
    addForm.reset();
    tabs[1].click(); // Switch to inventory tab
    addMessage(`تم إضافة منتج جديد: ${name} بنجاح!`, false);
});

// ==========================================
// 4.1 Edit Product Modal Logic
// ==========================================
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');
const closeEditModalBtn = document.getElementById('close-edit-modal');
const cancelEditBtn = document.getElementById('cancel-edit-btn');

function closeEditModal() {
    if (editModal) {
        editModal.classList.add('hidden');
    }
}

if (closeEditModalBtn) closeEditModalBtn.addEventListener('click', closeEditModal);
if (cancelEditBtn) cancelEditBtn.addEventListener('click', closeEditModal);

if (editModal) {
    editModal.addEventListener('click', (e) => {
        if (e.target === editModal) closeEditModal();
    });
}

window.editQty = function(id) {
    let products = getProducts();
    const item = products.find(i => i.id === id);
    if (!item) return;

    document.getElementById('edit-prod-id').value = item.id;
    document.getElementById('edit-prod-name').value = item.name;
    document.getElementById('edit-prod-qty').value = item.qty;
    document.getElementById('edit-prod-target-qty').value = item.targetQty;
    document.getElementById('edit-prod-price').value = item.price !== null && item.price !== undefined ? item.price : '';

    if (editModal) {
        editModal.classList.remove('hidden');
    }
};

if (editForm) {
    editForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = parseInt(document.getElementById('edit-prod-id').value);
        const name = document.getElementById('edit-prod-name').value.trim();
        const qty = parseInt(document.getElementById('edit-prod-qty').value);
        const targetQty = parseInt(document.getElementById('edit-prod-target-qty').value);
        const priceVal = document.getElementById('edit-prod-price').value;
        const price = priceVal !== '' ? parseInt(priceVal) : null;

        let products = getProducts();
        const itemIndex = products.findIndex(p => p.id === id);
        if (itemIndex !== -1) {
            const oldName = products[itemIndex].name;
            const oldQty = products[itemIndex].qty;
            const oldTarget = products[itemIndex].targetQty;
            const oldPrice = products[itemIndex].price;

            products[itemIndex] = {
                ...products[itemIndex],
                name,
                qty,
                targetQty,
                price
            };

            saveProducts(products);
            
            let changes = [];
            if (oldName !== name) changes.push(`الاسم: "${oldName}" ➔ "${name}"`);
            if (oldQty !== qty) changes.push(`الكمية: ${oldQty} ➔ ${qty}`);
            if (oldTarget !== targetQty) changes.push(`الحد: ${oldTarget} ➔ ${targetQty}`);
            if (oldPrice !== price) changes.push(`السعر: ${oldPrice || 0} ج ➔ ${price || 0} ج`);

            const changeText = changes.length > 0 ? changes.join('، ') : 'تعديل البيانات';
            logAction(`✏️ تم تعديل بيانات "${name}": ${changeText}.`);

            closeEditModal();
        }
    });
}

window.deleteItem = function(id) {
    if(confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
        let products = getProducts();
        const item = products.find(i => i.id === id);
        if(item) {
            products = products.filter(i => i.id !== id);
            saveProducts(products);
            logAction(`🗑️ تم حذف المنتج "${item.name}".`);
        }
    }
};

searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const products = getProducts();
    const filtered = products.filter(item => item.name.toLowerCase().includes(term));
    renderTable(filtered);
});

// ------------------------------------------
// Backup & Restore
// ------------------------------------------
const btnExport = document.getElementById('btn-export');
const importFile = document.getElementById('import-file');

if(btnExport) {
    btnExport.addEventListener('click', () => {
        const data = {
            inventory: JSON.parse(localStorage.getItem('arzaq_inventory')) || [],
            chat: JSON.parse(localStorage.getItem('arzaq_chat')) || [],
            logs: JSON.parse(localStorage.getItem('arzaq_logs')) || []
        };
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
        const a = document.createElement('a');
        a.href = dataStr;
        a.download = `نسخة_المخزون_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        logAction(`💾 تم أخذ نسخة احتياطية من النظام.`);
    });
}

if(importFile) {
    importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const data = JSON.parse(evt.target.result);
                if(data.inventory) localStorage.setItem('arzaq_inventory', JSON.stringify(data.inventory));
                if(data.chat) localStorage.setItem('arzaq_chat', JSON.stringify(data.chat));
                if(data.logs) localStorage.setItem('arzaq_logs', JSON.stringify(data.logs));
                
                alert('تم استعادة النسخة الاحتياطية بنجاح!');
                location.reload();
            } catch (err) {
                alert('عذراً، ملف النسخة الاحتياطية غير صالح.');
            }
        };
        reader.readAsText(file);
    });
}


// ==========================================
// 5. Smart Assistant Engine (المساعد الذكي مع الذاكرة)
// ==========================================
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const toggleChatBtn = document.getElementById('toggle-chat');
const chatbotBody = document.getElementById('chatbot-body');
const chatbotHeader = document.getElementById('chatbot-header');

// 💡 ميزة الذاكرة: حفظ المحادثة وحفظ آخر منتج تكلمنا عنه
let chatHistory = JSON.parse(localStorage.getItem('arzaq_chat')) || [
    { isUser: false, text: 'أهلاً! أنا مساعدك الذكي لإدارة المخزون 🤖\n\nأقدر أساعدك بـ:\n• "كتاوت كام؟" أو "عندك كام كتاوت؟"\n• "زود كتاوت 5" أو "نقص 3"\n• "سعر الكتاوت" أو "غير سعره 150"\n• "ضيف منتج بولي V 10 قطع بسعر 200"\n• "ايه الناقص" أو "كل البضاعة"\n• "امسح كتاوت" أو "احذفه"' }
];
let lastContextProductId = localStorage.getItem('arzaq_last_product_id') || null;

function renderChat() {
    chatMessages.innerHTML = '';
    chatHistory.forEach(msg => {
        const div = document.createElement('div');
        div.className = `message ${msg.isUser ? 'user-msg' : 'bot-msg'}`;
        div.textContent = msg.text;
        chatMessages.appendChild(div);
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

chatbotHeader.addEventListener('click', () => {
    chatbotBody.classList.toggle('hidden');
    toggleChatBtn.innerHTML = chatbotBody.classList.contains('hidden') ? '<i class="fas fa-chevron-up"></i>' : '<i class="fas fa-chevron-down"></i>';
});

function addMessage(text, isUser = false) {
    const div = document.createElement('div');
    div.className = `message ${isUser ? 'user-msg' : 'bot-msg'}`;
    div.textContent = text;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // حفظ في الذاكرة
    chatHistory.push({ isUser, text });
    if (chatHistory.length > 50) chatHistory = chatHistory.slice(chatHistory.length - 50); // نحتفظ بآخر 50 رسالة فقط
    localStorage.setItem('arzaq_chat', JSON.stringify(chatHistory));
}

function sendReply(reply) {
    setTimeout(() => addMessage(reply, false), 500);
}

// ===========================================
// تطبيع النص العربي (يعالج اللهجات والاختلافات)
// ===========================================
function normalizeText(text) {
    return text
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/ئ/g, 'ي')
        .replace(/ؤ/g, 'و')
        .replace(/[ًٌٍَُِّْ]/g, '') // إزالة التشكيل
        .replace(/\s+/g, ' ')
        .toLowerCase().trim();
}

// ===========================================
// البحث عن منتج بالاسم (مع مطابقة ذكية ومرونة)
// ===========================================
const PRODUCT_STOP_WORDS = new Set([
    'اسمه', 'اسمها', 'اسم', 'منتج', 'صنف', 'بضاعه', 'بضاعة', 'حاجه', 'حاجة',
    'جديد', 'جديدة', 'ال', 'الي', 'اللي', 'عندي', 'عندك', 'فيه', 'واحد', 'واحده',
    'واحدة', 'قطعه', 'قطعة', 'قطع', 'حته', 'حبة', 'كام', 'بكام', 'سعر', 'سعره',
    'كميه', 'كمية', 'عدد', 'زود', 'نقص', 'ضيف', 'اضف', 'خلي', 'خليه', 'خليهم'
]);

function findProduct(text, productsList) {
    let bestMatch = null;
    let highestScore = 0;
    const normInput = normalizeText(text);

    productsList.forEach(item => {
        let score = 0;
        const normName = normalizeText(item.name);
        if (!normName) return;

        // مطابقة كاملة
        if (normInput.includes(normName)) {
            score += 20;
        }

        const nameWords = normName.split(' ').filter(w => !PRODUCT_STOP_WORDS.has(w) && w.length >= 2);

        // مطابقة الكلمات ذات المعنى فقط
        nameWords.forEach(word => {
            if (normInput.includes(word)) {
                score += 5;
            } else if (word.length > 2 && normInput.includes(word + 'ات')) {
                // التعامل مع الجمع (كتاوتات، لمبات)
                score += 4;
            } else if (word.endsWith('ه') && normInput.includes(word.slice(0, -1) + 'ات')) {
                score += 4;
            } else if (word.length > 3 && normInput.includes(word.slice(0, -1))) {
                // بدون آخر حرف (اختصار)
                score += 2;
            }
        });

        // مطابقة أولى كلمتين إذا لم تكن كلمات توقف
        if (nameWords.length >= 2) {
            const twoWords = nameWords[0] + ' ' + nameWords[1];
            if (normInput.includes(twoWords)) score += 10;
        }

        if (score > highestScore && score >= 4) {
            highestScore = score;
            bestMatch = item;
        }
    });

    return bestMatch;
}

// ===========================================
// استخراج الأرقام العربية الهندية والكلمات المكتوبة باللغة العربية
// ===========================================
function parseArabicNumbers(text) {
    if (!text) return [];

    // 1. تحويل الأرقام المشرقية (٠١٢٣٤٥٦٧٨٩) إلى (0123456789)
    let str = text
        .replace(/٠/g, '0')
        .replace(/١/g, '1')
        .replace(/٢/g, '2')
        .replace(/٣/g, '3')
        .replace(/٤/g, '4')
        .replace(/٥/g, '5')
        .replace(/٦/g, '6')
        .replace(/٧/g, '7')
        .replace(/٨/g, '8')
        .replace(/٩/g, '9');

    // 2. تحويل الكلمات المنطوقة إلى أرقام
    const wordMap = [
        { regex: /(?:^|\s)(?:خمسمية|خمسمائة)(?:\s|$)/gi, val: ' 500 ' },
        { regex: /(?:^|\s)(?:اربعمية|أربعمائة)(?:\s|$)/gi, val: ' 400 ' },
        { regex: /(?:^|\s)(?:تلاتمية|ثلاثمائة)(?:\s|$)/gi, val: ' 300 ' },
        { regex: /(?:^|\s)(?:ميتين|مئتان|مائتان)(?:\s|$)/gi, val: ' 200 ' },
        { regex: /(?:^|\s)(?:مية|مائة|ميـة)(?:\s|$)/gi, val: ' 100 ' },
        { regex: /(?:^|\s)(?:تسعين|تسعون)(?:\s|$)/gi, val: ' 90 ' },
        { regex: /(?:^|\s)(?:تمانين|ثمانين)(?:\s|$)/gi, val: ' 80 ' },
        { regex: /(?:^|\s)(?:سبعين|سبعون)(?:\s|$)/gi, val: ' 70 ' },
        { regex: /(?:^|\s)(?:ستين|ستون)(?:\s|$)/gi, val: ' 60 ' },
        { regex: /(?:^|\s)(?:خمسين|خمسون)(?:\s|$)/gi, val: ' 50 ' },
        { regex: /(?:^|\s)(?:اربعين|أربعين)(?:\s|$)/gi, val: ' 40 ' },
        { regex: /(?:^|\s)(?:تلاتين|ثلاثين)(?:\s|$)/gi, val: ' 30 ' },
        { regex: /(?:^|\s)(?:عشرين|عشرون)(?:\s|$)/gi, val: ' 20 ' },
        { regex: /(?:^|\s)(?:خمستاشر|خمسة عشر)(?:\s|$)/gi, val: ' 15 ' },
        { regex: /(?:^|\s)(?:اربعطاشر|اربعتاشر|أربعة عشر)(?:\s|$)/gi, val: ' 14 ' },
        { regex: /(?:^|\s)(?:تلاتطاشر|تلاتاشر|ثلاثة عشر)(?:\s|$)/gi, val: ' 13 ' },
        { regex: /(?:^|\s)(?:اتناشر|اثنا عشر)(?:\s|$)/gi, val: ' 12 ' },
        { regex: /(?:^|\s)(?:حداشر|أحد عشر)(?:\s|$)/gi, val: ' 11 ' },
        { regex: /(?:^|\s)(?:عشرة|عشر)(?:\s|$)/gi, val: ' 10 ' },
        { regex: /(?:^|\s)(?:تسعة|تسع)(?:\s|$)/gi, val: ' 9 ' },
        { regex: /(?:^|\s)(?:ثمانية|تمانية|تمان)(?:\s|$)/gi, val: ' 8 ' },
        { regex: /(?:^|\s)(?:سبعة|سبع)(?:\s|$)/gi, val: ' 7 ' },
        { regex: /(?:^|\s)(?:ستة|ست)(?:\s|$)/gi, val: ' 6 ' },
        { regex: /(?:^|\s)(?:خمسة|خمس)(?:\s|$)/gi, val: ' 5 ' },
        { regex: /(?:^|\s)(?:اربعة|أربعة|اربع)(?:\s|$)/gi, val: ' 4 ' },
        { regex: /(?:^|\s)(?:تلاتة|ثلاثة|تلات)(?:\s|$)/gi, val: ' 3 ' },
        { regex: /(?:^|\s)(?:اتنين|اثنين|جوز)(?:\s|$)/gi, val: ' 2 ' },
        { regex: /(?:^|\s)(?:واحد|واحدة|حبة|قطعة)(?:\s|$)/gi, val: ' 1 ' }
    ];

    wordMap.forEach(w => {
        str = str.replace(w.regex, w.val);
    });

    const matches = str.match(/\d+/g);
    return matches ? matches.map(n => parseInt(n)) : [];
}

// ===========================================
// محرك فهم الأوامر الذكي (NLP Intent Engine)
// ===========================================
function processAssistantCommand(text) {
    text = (text || '').trim();
    if (!text) return;
    if (chatInput) chatInput.value = '';
    addMessage(text, true);

    const normText = normalizeText(text);
    let products = getProducts();

    // ------------------------------------------
    // 0. INTENT: إضافة منتج جديد (صريح من الشات)
    // ------------------------------------------
    const isExplicitAddProduct = normText.match(/(?:ضيف|اضف|اضافة|اضافه|زود|حط|سجل|اعمل|دخل|ادخل|انشئ|انشاء)\s+(?:منتج|صنف|بضاعه|بضاعة|جديد)/) || 
                                normText.match(/^(?:منتج جديد|صنف جديد|منتج اسمه|صنف اسمه|منتج|صنف)\s+/) ||
                                normText.match(/^(?:اسمه|اسمها)\s+/);

    if (isExplicitAddProduct) {
        let rawName = text
            .replace(/(?:ممكن|عايز|عاوز|لو سمحت)?\s*(?:ضيف|اضف|اضافة|اضافه|زود|حط|سجل|اعمل|دخل|ادخل|انشئ|انشاء)\s+(?:منتج|صنف|بضاعه|بضاعة|جديد)?/gi, '')
            .replace(/^(?:اسمه|اسمها|اسم|اسمه الـ|اسمه ال|حاجه اسمها|حاجة اسمها|واحد اسمه|واحده اسمها|واحدة اسمها)\s+/gi, '')
            .trim();

        let foundQty = 0;
        let foundPrice = null;
        let foundTarget = 10;

        const numbers = parseArabicNumbers(text);
        // التحقق من وجود كلمات صريحة تدل على الكمية أو السعر
        const pricePatternMatch = text.match(/(?:بسعر|سعر|سعره)\s*[:=]?\s*(\d+)/i) || text.match(/(\d+)\s*(?:جنيه|ج\b)/i);
        const qtyPatternMatch = text.match(/(?:كمية|كميه|بكمية|بكميه|عدد|قطع|قطعه|حبات|حته)\s*[:=]?\s*(\d+)/i);

        if (pricePatternMatch) {
            foundPrice = parseInt(pricePatternMatch[1]);
            rawName = rawName.replace(pricePatternMatch[0], ' ');
        }
        if (qtyPatternMatch) {
            foundQty = parseInt(qtyPatternMatch[1]);
            rawName = rawName.replace(qtyPatternMatch[0], ' ');
        } else if (numbers && numbers.length > 0 && !rawName.match(/\b(?:مسمار|فولت|طرف|بوصة|بوصه|ملي|ملليمتر|خط|شمعة|شمعه|حصان|وات|امبير)\b/i)) {
            // لو مفيش لفظ تمييز يخص المنتج، وأول رقم جاي في الآخر
            const trailingNumMatch = rawName.match(/\s+(\d+)\s*$/);
            if (trailingNumMatch) {
                foundQty = parseInt(trailingNumMatch[1]);
                rawName = rawName.replace(/\s+\d+\s*$/, ' ');
            }
        }
        rawName = rawName.replace(/^(?:اسمه|اسمها|اسم)\s+/gi, '')
                         .replace(/\s+/g, ' ')
                         .trim();

        if (rawName.length >= 2) {
            const newProd = {
                id: Date.now(),
                name: rawName,
                qty: foundQty,
                targetQty: foundQty > 0 ? foundQty : foundTarget,
                price: foundPrice
            };
            products.push(newProd);
            saveProducts(products);
            lastContextProductId = newProd.id;
            localStorage.setItem('arzaq_last_product_id', lastContextProductId);
            logAction(`📦 تم إضافة منتج جديد من الشات: "${newProd.name}" بكمية ${newProd.qty} قطعة.`);
            return sendReply(`✅ تم إضافة المنتج الجديد "${newProd.name}" إلى قاعدة البيانات بنجاح!\nالكمية: ${newProd.qty}\nالسعر: ${newProd.price ? newProd.price + ' ج' : 'غير محدد'}`);
        } else {
            return sendReply("لإضافة منتج، يرجى كتابة اسمه بوضوح مثل: (زود منتج فليشر 10 قطع بسعر 50).");
        }
    }

    let product = findProduct(text, products);
    let usedMemory = false;

    // استخراج الأرقام
    const numbers = parseArabicNumbers(text);
    const amount = numbers && numbers.length > 0 ? numbers[0] : null;

    // ------------------------------------------
    // INTENT: تحية ومساعدة
    // ------------------------------------------
    if (normText.match(/^(اهلا|مرحبا|هاي|هلو|السلام|صباح|مساء|ازيك|عامل|كيف حالك|hi|hello)/)) {
        return sendReply('أهلاً وسهلاً! 👋 أنا هنا لمساعدتك في إدارة المخزون.\nقولي إيه اللي عايزه وأنا جاهز!');
    }

    if (normText.match(/مساعده|ساعدني|ايه اللي تعمله|ايه اوامرك|الاوامر|قائمه الاوامر|ايه ممكن|وظيفتك/)) {
        return sendReply(
            '🤖 أنا مساعدك لإدارة المخزون! إليك الأوامر المتاحة:\n\n' +
            '📦 عرض المعلومات:\n' +
            '• "كتاوت كام؟" — عرض الكمية\n' +
            '• "سعر الكتاوت" — عرض السعر\n' +
            '• "ايه الناقص" — عرض النواقص\n' +
            '• "كل البضاعة" — عرض كل المخزون\n' +
            '• "إجمالي المخزون" — قيمة المخزون\n\n' +
            '✏️ تعديل البيانات:\n' +
            '• "زود كتاوت 5" — إضافة كمية\n' +
            '• "نقص/بعت كتاوت 3" — خصم كمية\n' +
            '• "خلي كتاوت 20" — ضبط الكمية مباشرة\n' +
            '• "سعر كتاوت 150" — تغيير السعر\n' +
            '• "الحد كتاوت 30" — تغيير الحد المطلوب\n\n' +
            '➕ إضافة وحذف:\n' +
            '• "ضيف منتج بولي V 10 بسعر 200" — إضافة منتج\n' +
            '• "امسح كتاوت" — حذف منتج'
        );
    }

    // ------------------------------------------
    // INTENT: إحصائيات المخزون
    // ------------------------------------------
    if (normText.match(/اجمالي المخزون|قيمه المخزون|كم قيمه|احصائيات|الاحصائيات|ملخص|نبذه|overview/)) {
        const total = products.length;
        const available = products.filter(p => p.qty > 0).length;
        const outOfStock = products.filter(p => p.qty === 0).length;
        const shortage = products.filter(p => p.qty < p.targetQty).length;
        const totalValue = products.reduce((acc, p) => acc + ((p.qty || 0) * (p.price || 0)), 0);
        return sendReply(
            `📊 ملخص المخزون:\n` +
            `• إجمالي المنتجات: ${total}\n` +
            `• المتوفرة: ${available}\n` +
            `• المنتهية (صفر): ${outOfStock}\n` +
            `• الناقصة عن الحد: ${shortage}\n` +
            `• قيمة المخزون: ${totalValue.toLocaleString('ar-EG')} جنيه`
        );
    }

    // ------------------------------------------
    // INTENT: الأغلى / الأرخص
    // ------------------------------------------
    if (normText.match(/الاغلي|الاعلي سعرا|اغلي منتج/)) {
        const sorted = products.filter(p => p.price).sort((a, b) => b.price - a.price);
        if (sorted.length === 0) return sendReply('لا يوجد منتجات بسعر محدد.');
        const top = sorted[0];
        return sendReply(`💰 أغلى منتج هو "${top.name}" بسعر ${top.price} جنيه.`);
    }

    if (normText.match(/الارخص|ارخص منتج|اقل سعرا/)) {
        const sorted = products.filter(p => p.price).sort((a, b) => a.price - b.price);
        if (sorted.length === 0) return sendReply('لا يوجد منتجات بسعر محدد.');
        const top = sorted[0];
        return sendReply(`💰 أرخص منتج هو "${top.name}" بسعر ${top.price} جنيه.`);
    }

    // ------------------------------------------
    // INTENT: عرض كل البضاعة
    // ------------------------------------------
    if (normText.match(/كل البضاعه|كل المنتجات|عرض الكل|اعرضلي كل|قائمه المخزون|المخزون كله/)) {
        if (products.length === 0) return sendReply('المخزون فارغ حالياً.');
        let replyStr = '📦 قائمة المخزون الكاملة:\n\n' + products.map((p, i) => {
            const missing = Math.max(p.targetQty - p.qty, 0);
            const status = p.qty === 0 ? '❌ خلصان' : p.qty < p.targetQty ? '🔴 ناقص' : '✅ متوفر';
            return `${i+1}. ${p.name}\n   الموجود: ${p.qty} | المطلوب: ${p.targetQty} | السعر: ${p.price || 0} ج\n   الحالة: ${status}${missing > 0 ? ' (ناقص ' + missing + ')' : ''}`;
        }).join('\n\n');
        return sendReply(replyStr);
    }

    // ------------------------------------------
    // INTENT: النواقص
    // ------------------------------------------
    if (normText.match(/ايه الناقص|المنتجات الناقصه|ايه النواقص|ايه اللي خلصان|اللي ناقص|النواقص|اللي محتاجه/)) {
        const shortages = products.filter(p => p.qty < p.targetQty);
        if (shortages.length === 0) return sendReply('✅ المخزون مكتمل! لا يوجد نواقص.');
        let replyStr = `🔴 المنتجات الناقصة (${shortages.length}):\n\n` +
            shortages.map(p => {
                const miss = p.targetQty - p.qty;
                return `${p.qty === 0 ? '❌' : '🔴'} ${p.name} — ناقص ${miss} (موجود ${p.qty}/${p.targetQty})`;
            }).join('\n');
        return sendReply(replyStr);
    }

    // ------------------------------------------
    // INTENT: بحث عن منتج
    // ------------------------------------------
    if (normText.match(/ابحث عن|بحث|فين|وين|هل عندك|هل في/) && !product) {
        const searchTerm = normText
            .replace(/ابحث عن|ابحث|بحث عن|بحث|فين|وين|هل عندك|هل في|عندي|موجود/g, '').trim();
        if (searchTerm.length > 1) {
            const found = products.filter(p => normalizeText(p.name).includes(searchTerm));
            if (found.length > 0) {
                return sendReply('🔍 النتائج:\n' + found.map(p => `• ${p.name} — الكمية: ${p.qty}`).join('\n'));
            } else {
                return sendReply(`🔍 لم أجد "${searchTerm}" في المخزون.`);
            }
        }
    }

    let reply = 'عفواً، لم أفهم الأمر.';

function isPureContinuationCommand(normText) {
    let str = ' ' + normText.replace(/\d+/g, '').replace(/[٠١٢٣٤٥٦٧٨٩]/g, '') + ' ';
    const commandWords = [
        'طب','طيب','ماشي','لو','سمحت','بالله','عليك','بقولك','بقول','يا','سيدي','باشا','يا باشا','ممكن','عايز','عاوز',
        'علي','على','في','من','سعره','سعرها','السعر','سعر','كميته','كميتها','الكميه','الكمية','كميه','كمية',
        'ليه','ليها','بتاعه','بتاعها','خلي','خليه','خليهم','يخلي','جنيه','جنيها','قطعه','قطعة','حته','حبة','حبات','عليهم','كمان',
        'بكام','كام','كم','موجود','زود','زوده','ضيف','اضف','حط','نقص','نقصه','قلل','بعت','صرفت','بيع',
        'احذف','احذفه','امسح','امسحه','شيل','شيله','هل','ناقص','خلصان','بقي','بقى','دي','ده','دلوقتي','اللي','ال','قولت','لك'
    ];
    
    commandWords.forEach(w => {
        const regex = new RegExp(`\\s${w}\\s`, 'g');
        str = str.replace(regex, ' ');
        str = str.replace(regex, ' ');
    });
    
    return (str.trim() === '');
}

    if (product) {
        lastContextProductId = product.id;
        localStorage.setItem('arzaq_last_product_id', lastContextProductId);
    } else if (lastContextProductId && isPureContinuationCommand(normText)) {
        // نستخدم الذاكرة فقط إذا كان الكلام عبارة عن أمر متابعة مجرد بدون ذكر اسم جديد
        const memProd = products.find(p => p.id == lastContextProductId);
        if (memProd) {
            product = memProd;
            usedMemory = true;
        }
    }

    // --- إذا لم يجد المنتج لا في النص ولا في الذاكرة ---
    if (!product) {
        // فحص إذا كان المستخدم يريد إضافة منتج غير موجود مباشرة من الشات
        if (normText.match(/^(?:ضيف|اضف|اضافة|اضافه|زود|حط|سجل|اعمل|دخل|ادخل)\s+/)) {
            let rawName = text
                .replace(/^(?:ضيف|اضف|اضافة|اضافه|زود|حط|سجل|اعمل|دخل|ادخل)\s+(?:منتج|صنف|قطعه|قطعة|بضاعه|بضاعة)?/i, '')
                .replace(/^(?:اسمه|اسمها|اسم|اسمه الـ|اسمه ال|حاجه اسمها|حاجة اسمها|واحد اسمه|واحده اسمها|واحدة اسمها)\s+/gi, '')
                .trim();
            let foundQty = 0;
            let foundPrice = null;
            let foundTarget = 10;
            
            if (numbers && numbers.length > 0) {
                foundQty = numbers[0];
                if (numbers.length > 1) {
                    foundPrice = numbers[1];
                }
                rawName = rawName.replace(/\d+/g, '')
                                 .replace(/[٠١٢٣٤٥٦٧٨٩]/g, '')
                                 .replace(/كميه|كمية|بكمية|بكميه|عدد|قطع|قطعه|سعر|بسعر|جنيه|جنيها/g, '')
                                 .replace(/(?:^|\s+)(?:اسمه|اسمها|اسم)(?:\s+|$)/gi, ' ')
                                 .trim();
            }
            rawName = rawName.replace(/^(?:اسمه|اسمها|اسم)\s+/gi, '').trim();

            if (rawName.length >= 2) {
                const newProd = {
                    id: Date.now(),
                    name: rawName,
                    qty: foundQty,
                    targetQty: foundQty > 0 ? foundQty : foundTarget,
                    price: foundPrice
                };
                products.push(newProd);
                saveProducts(products);
                lastContextProductId = newProd.id;
                localStorage.setItem('arzaq_last_product_id', lastContextProductId);
                logAction(`📦 تم إضافة منتج جديد من الشات: "${newProd.name}" بكمية ${newProd.qty} قطعة.`);
                return sendReply(`✅ تم إضافة المنتج الجديد "${newProd.name}" إلى قاعدة البيانات بنجاح!\nالكمية: ${newProd.qty}\nالسعر: ${newProd.price ? newProd.price + ' ج' : 'غير محدد'}`);
            } else {
                reply = "لإضافة منتج، يرجى كتابة اسمه بوضوح مثل: (زود منتج فليشر 10 قطع بسعر 50).";
                return sendReply(reply);
            }
        } else {
            // استخراج اسم المنتج الذي يبحث عنه المستخدم
            let searchWord = text
                .replace(/(?:يا|باشا|يا باشا|بقول|لك|قولت|لو سمحت|ممكن|عندك|في|عندي|هل|فيه)?/gi, '')
                .replace(/^(?:اسمه|اسمها|اسم)\s+/gi, '')
                .trim();

            if (searchWord.length >= 2) {
                reply = `🔍 لم أجد "${searchWord}" في المخزون حالياً.\n\nإذا كنت تريد إضافته كمنتج جديد، قولي: (ضيف منتج ${searchWord} 10 بسعر 50).`;
            } else {
                reply = "لم أتعرف على اسم المنتج في كلامك. تأكد من الاسم أو قولي (ضيف منتج اسم_المنتج 10).";
            }
            return sendReply(reply);
        }
    }

    // إضافة توضيح بسيط لو استخدمنا الذاكرة عشان المساعد يوضح إنه فاكر
    const memoryHint = usedMemory ? `💡 بخصوص (${product.name}):\n` : "";

    // --- العمليات المرتبطة بالمنتج (المستخرج من النص أو الذاكرة) ---

    // ------------------------------------------
    // 2.4 COMBINED INTENT: تحديث السعر والكمية معا في نفس الرسالة
    // ------------------------------------------
    const priceMatch = text.match(/(?:سعر|سعره|السعر)[^\d]*(\d+)/i) || text.match(/(\d+)\s*(?:جنيه|ج\b)/i);
    const qtyMatch = text.match(/(?:كميه|كمية|الكميه|الكمية|عدد|قطعه|قطع|خليهم|خلي|زود|نقص)[^\d]*(\d+)/i);

    if (priceMatch && qtyMatch && (normText.includes('سعر') || normText.includes('سعره')) && (normText.includes('كمي') || normText.includes('كمية') || normText.includes('كميه') || normText.includes('عدد'))) {
        const newPrice = parseInt(priceMatch[1]);
        const newQty = parseInt(qtyMatch[1]);
        
        product.price = newPrice;
        product.qty = newQty;
        saveProducts(products);
        logAction(`✏️ قام المساعد بتحديث سعر "${product.name}" إلى ${newPrice} ج والكمية إلى ${newQty} قطعة.`);
        return sendReply(memoryHint + `✅ تم تحديث "${product.name}" بنجاح:\n• السعر أصبح: ${newPrice} جنيه\n• الكمية أصبحت: ${newQty} قطعة`);
    }

    // ------------------------------------------
    // 2.5 INTENT: ضبط وتعديل الكمية مباشرة (SET QUANTITY)
    // ------------------------------------------
    if (normText.match(/خلي|خليه|خليهم|اضبط|ظبط|عدل الكميه|الكميه بقت|اجعلها|اجعله/) && amount !== null && !normText.includes('سعر') && !normText.match(/الحد|الحد المطلوب|الهدف|التارجت/)) {
        const oldQty = product.qty;
        product.qty = amount;
        saveProducts(products);
        logAction(`✏️ قام المساعد بتعديل كمية "${product.name}" مباشرة من ${oldQty} إلى ${product.qty} قطعة.`);
        return sendReply(memoryHint + `✅ تم ضبط كمية ${product.name} مباشرة وأصبحت الآن ${product.qty} قطعة.`);
    }

    // ------------------------------------------
    // 2.6 INTENT: تغيير الحد المطلوب (TARGET QTY)
    // ------------------------------------------
    if (normText.match(/الحد|الحد المطلوب|الهدف|التارجت|المطلوب يكون|الكميه المطلوبه/) && amount !== null) {
        const oldTarget = product.targetQty;
        product.targetQty = amount;
        saveProducts(products);
        logAction(`🎯 قام المساعد بتغيير الحد المطلوب لـ "${product.name}" من ${oldTarget} إلى ${amount} قطعة.`);
        const missing = Math.max(product.targetQty - product.qty, 0);
        return sendReply(memoryHint + `✅ تم تغيير الحد المطلوب لـ ${product.name} إلى ${amount} قطعة.\nالموجود حالياً: ${product.qty} | الناقص: ${missing}`);
    }

    // ------------------------------------------
    // 3. INTENT: تعديل السعر
    // ------------------------------------------
    if ((normText.includes('سعر') || normText.match(/غير سعره|بدل سعره|سعره يبقي/)) && amount !== null && !normText.match(/كام|كم|بكام/)) {
        let oldPrice = product.price || 0;
        if (normText.match(/زود|ضيف|اضف|حط|رفع|ارفع/)) {
            product.price = oldPrice + amount;
            saveProducts(products);
            logAction(`💰 قام المساعد بزيادة سعر "${product.name}" من ${oldPrice} إلى ${product.price} جنيه.`);
            return sendReply(memoryHint + `تم تزويد السعر، وأصبح سعر ${product.name} دلوقتي ${product.price} جنيه.`);
        } else if (normText.match(/نقص|قلل|خفض/)) {
            product.price = Math.max(oldPrice - amount, 0);
            saveProducts(products);
            logAction(`💰 قام المساعد بتقليل سعر "${product.name}" من ${oldPrice} إلى ${product.price} جنيه.`);
            return sendReply(memoryHint + `تم تقليل السعر، وأصبح سعر ${product.name} دلوقتي ${product.price} جنيه.`);
        } else {
            product.price = amount;
            saveProducts(products);
            logAction(`💰 قام المساعد بتحديث سعر "${product.name}" من ${oldPrice} إلى ${amount} جنيه.`);
            return sendReply(memoryHint + `تم تحديث سعر ${product.name} إلى ${amount} جنيه.`);
        }
    }

    // ------------------------------------------
    // 4. INTENT: الاستعلام عن السعر
    // ------------------------------------------
    if (normText.match(/سعر|بكام|سعره|تمنه|بتاع بكام/)) {
        return sendReply(memoryHint + `سعر ${product.name} هو ${product.price ? product.price + ' جنيه' : 'غير محدد بعد'}.`);
    }

    // ------------------------------------------
    // 5. INTENT: زيادة الكمية (ADD)
    // ------------------------------------------
    if (normText.match(/زود|ضيف|اضف|حط|وصل|جاء|اشتريت|استلمت|وصلت/)) {
        if (amount) {
            product.qty += amount;
            saveProducts(products);
            logAction(`➕ قام المساعد بإضافة ${amount} قطعة إلى "${product.name}". (الإجمالي: ${product.qty})`);
            return sendReply(memoryHint + `✅ تم إضافة ${amount} لـ ${product.name}.\nالكمية أصبحت ${product.qty} من ${product.targetQty}.`);
        } else {
            return sendReply(memoryHint + `عايز تزود كام قطعة من ${product.name}؟ قول الرقم.`);
        }
    }

    // ------------------------------------------
    // 6. INTENT: خصم الكمية (REMOVE)
    // ------------------------------------------
    if (normText.match(/نقص|قلل|بعت|صرفت|بيع|خصم|استخدمت|اخدت|طلع/)) {
        if (amount) {
            if (product.qty >= amount) {
                product.qty -= amount;
                saveProducts(products);
                const missing = Math.max(product.targetQty - product.qty, 0);
                logAction(`➖ قام المساعد بصرف ${amount} قطعة من "${product.name}". (المتبقي: ${product.qty})`);
                return sendReply(memoryHint + `✅ تم خصم ${amount} من ${product.name}.\nالكمية أصبحت ${product.qty} من ${product.targetQty}، والناقص ${missing}.`);
            } else {
                return sendReply(memoryHint + `⚠️ مش ممكن تخصم ${amount}. الموجود حاليًا من ${product.name} هو ${product.qty} فقط.`);
            }
        } else {
            return sendReply(memoryHint + `عايز تنقص كام قطعة من ${product.name}؟ قول الرقم.`);
        }
    }


    // ------------------------------------------
    // 7. INTENT: حذف منتج (DELETE)
    // ------------------------------------------
    if (normText.match(/احذف|امسح|شيل/)) {
        products = products.filter(p => p.id !== product.id);
        saveProducts(products);
        logAction(`🗑️ قام المساعد بحذف المنتج "${product.name}".`);
        // مسح الذاكرة عشان المنتج مبقاش موجود
        lastContextProductId = null; 
        localStorage.removeItem('arzaq_last_product_id');
        return sendReply(memoryHint + `تم حذف "${product.name}" من المخزون بنجاح.`);
    }

    // ------------------------------------------
    // 8. INTENT: حالة المنتج (هل ... ناقص؟)
    // ------------------------------------------
    if (normText.includes('هل') && (normText.includes('ناقص') || normText.includes('خلصان'))) {
        if (product.qty < product.targetQty) {
            return sendReply(memoryHint + `أيوه، ${product.name} ناقص ${product.targetQty - product.qty}.\nالموجود ${product.qty} من أصل ${product.targetQty}.`);
        } else {
            return sendReply(memoryHint + `لا، ${product.name} متوفرة بالكامل.\nالموجود ${product.qty} من أصل ${product.targetQty}.`);
        }
    }

    // ------------------------------------------
    // 9. INTENT: الاستعلام عن الكمية (GET_QUANTITY)
    // ------------------------------------------
    if (normText.match(/كام|كم|موجود/)) {
        const missing = Math.max(product.targetQty - product.qty, 0);
        return sendReply(memoryHint + `عندك ${product.qty} ${product.name}.\nالمطلوب ${product.targetQty}، يعني ناقص ${missing}.`);
    }

    // ------------------------------------------
    // FALLBACK: إذا ذكر منتج بس بدون أمر واضح (أو لو دخل مجرد رقم)
    // ------------------------------------------
    if (usedMemory && amount && !normText.match(/[a-zA-Zء-ي]/)) {
        // لو دخل مجرد رقم واسم المنتج في الذاكرة
        return sendReply(`💡 بخصوص (${product.name}): الرقم اللي دخلته (${amount}) عايز تزوده ولا تنقصه؟`);
    }
    
    return sendReply(memoryHint + `أنت تقصد "${product.name}".\nالكمية: ${product.qty}\nالسعر: ${product.price || 0} ج\nعايز تزود ولا تنقص ولا تعدل السعر؟`);
}

// ------------------------------------------
// ربط واجهة الإدخال بالمحرك
// ------------------------------------------
sendBtn.addEventListener('click', () => {
    const val = chatInput.value;
    chatInput.value = '';
    processAssistantCommand(val);
});

chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        const val = chatInput.value;
        chatInput.value = '';
        processAssistantCommand(val);
    }
});

// ==========================================
// 6. Speech Recognition (المايكروفون)
// ==========================================
const micBtn = document.getElementById('mic-btn');
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// كشف نوع الجهاز والمتصفح
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isChromeOnIOS = isIOS && /CriOS/.test(navigator.userAgent);
const isFirefoxOnIOS = isIOS && /FxiOS/.test(navigator.userAgent);

// على Chrome/Firefox للآيفون — مايك مش متاح
if ((isChromeOnIOS || isFirefoxOnIOS) && micBtn) {
    micBtn.title = 'المايك لا يعمل على Chrome/Firefox للآيفون — استخدم Safari';
    micBtn.style.opacity = '0.4';
    micBtn.addEventListener('click', () => {
        if (chatbotBody.classList.contains('hidden')) {
            chatbotBody.classList.remove('hidden');
        }
        addMessage(
            '🍎 على الآيفون، المايكروفون يعمل فقط مع متصفح Safari.\n\n' +
            'الحل: افتح الموقع في Safari وليس Chrome أو Firefox.',
            false
        );
    });
} else if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = isIOS ? 'ar-SA' : 'ar-EG';
    recognition.interimResults = true; // كتابة الكلمات فور التحدث بها لحظياً
    recognition.maxAlternatives = 1;
    recognition.continuous = true;     // الاستماع المستمر حتى ينتهي المستخدم من كلامه

    let shouldKeepListening = false;
    let lastProcessedText = '';
    let speechSilenceTimeout = null;
    let fullSessionTranscript = '';

    function dispatchAccumulatedSpeech() {
        if (speechSilenceTimeout) {
            clearTimeout(speechSilenceTimeout);
            speechSilenceTimeout = null;
        }

        const textToProcess = (fullSessionTranscript || chatInput.value || '').trim();
        fullSessionTranscript = '';

        if (textToProcess && textToProcess !== lastProcessedText) {
            lastProcessedText = textToProcess;
            chatInput.value = textToProcess;
            chatInput.placeholder = 'جاري تنفيذ الأمر...';
            processAssistantCommand(textToProcess);
            setTimeout(() => {
                if (chatInput) {
                    chatInput.value = '';
                    if (shouldKeepListening) {
                        chatInput.placeholder = '🎙️ سامعك.. كمل كلامك أو قول الأمر اللي بعده';
                    } else {
                        chatInput.placeholder = 'اكتب سؤالك أو أمرك هنا...';
                    }
                }
            }, 250);
        }
    }

    recognition.onstart = function() {
        micBtn.classList.add('recording');
        chatInput.placeholder = '🎙️ سامعك.. اتكلم براحتك وأنا هسمعك للآخر';
    };

    recognition.onresult = function(event) {
        if (!event.results || event.results.length === 0) return;

        // تجميع كل الكلام (المؤكد واللحظي) من جلسة الاستماع الحالية
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = 0; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript + ' ';
            } else {
                interimTranscript += event.results[i][0].transcript + ' ';
            }
        }

        const currentLiveText = (finalTranscript + interimTranscript).replace(/\s+/g, ' ').trim();

        if (currentLiveText) {
            fullSessionTranscript = currentLiveText;
            // كتابة ما يسمعه المايك فوراً أمام المستخدم حتى يراه بعينه
            chatInput.value = currentLiveText;

            // إعادة ضبط مؤقت الصمت: لا ينفذ الأمر إلا بعد أن يسكت المستخدم لمدة ثانية كاملة (1000ms)
            if (speechSilenceTimeout) {
                clearTimeout(speechSilenceTimeout);
            }
            speechSilenceTimeout = setTimeout(() => {
                dispatchAccumulatedSpeech();
            }, 1000); // ينتظر ثانية واحدة بعد السكوت
        }
    };

    recognition.onerror = function(event) {
        console.warn('Speech recognition status/error:', event.error);
        if (event.error === 'no-speech') {
            // استمر في الاستماع حتى لو سكت المستخدم لفترة
            return;
        }

        if (event.error === 'not-allowed' || event.error === 'permission-denied') {
            shouldKeepListening = false;
            micBtn.classList.remove('recording');
            chatInput.placeholder = 'اكتب سؤالك أو أمرك هنا...';
            addMessage(
                '❌ تم رفض صلاحية المايكروفون.\n\n' +
                'لتفعيله على الموبايل:\n' +
                '1️⃣ اضغط على أيقونة 🔒 أو ⓘ بجانب الرابط\n' +
                '2️⃣ اختر "الأذونات" أو "Permissions"\n' +
                '3️⃣ فعّل "الميكروفون" أو "Microphone"\n' +
                '4️⃣ أعد تحميل الصفحة وحاول مرة أخرى',
                false
            );
        } else if (event.error === 'network') {
            addMessage('📶 المايك يحتاج اتصال إنترنت ليشتغل. تأكد من الاتصال.', false);
        }
    };

    recognition.onend = function() {
        // إذا كان هناك كلام معلق، نفذه فوراً
        if (fullSessionTranscript) {
            dispatchAccumulatedSpeech();
        }

        // إذا كان وضع الاستماع مفعلاً، يتم إعادة تشغيل المايك فوراً بدون مقاطعة المستخدم
        if (shouldKeepListening) {
            try {
                recognition.start();
            } catch (e) {
                // تجاهل إذا كان يعمل بالفعل
            }
        } else {
            micBtn.classList.remove('recording');
            chatInput.placeholder = 'اكتب سؤالك أو أمرك هنا...';
        }
    };

    micBtn.addEventListener('click', () => {
        // افتح الشات لو مقفول
        if (chatbotBody.classList.contains('hidden')) {
            chatbotBody.classList.remove('hidden');
            toggleChatBtn.innerHTML = '<i class="fas fa-chevron-down"></i>';
        }

        if (window.location.protocol === 'file:') {
            addMessage('⚠️ المايكروفون لا يعمل عند فتح الملف مباشرة.\n\nالحل: شغل الموقع من ملف "تشغيل_الموقع.bat" الموجود في نفس المجلد.', false);
            return;
        }

        if (shouldKeepListening) {
            // إيقاف يدوي عند الضغط على زر المايك مرة أخرى
            shouldKeepListening = false;
            dispatchAccumulatedSpeech();
            try { recognition.stop(); } catch(e) {}
            micBtn.classList.remove('recording');
            chatInput.placeholder = 'اكتب سؤالك أو أمرك هنا...';
            addMessage('🎙️ تم إيقاف الاستماع للمايكروفون.', false);
        } else {
            // بدء الاستماع
            shouldKeepListening = true;
            lastProcessedText = '';
            fullSessionTranscript = '';
            try {
                recognition.start();
            } catch (e) {
                if (e.name !== 'InvalidStateError') {
                    addMessage('⚠️ تعذر تشغيل المايكروفون. حاول مرة أخرى.', false);
                }
            }
        }
    });
} else {
    // المتصفح لا يدعم الـ Speech Recognition
    if (micBtn) {
        micBtn.style.display = 'none';
    }
    console.log('Speech Recognition API not supported in this browser.');
}

// Init Application
renderChat();
updateUI();
