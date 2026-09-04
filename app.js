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
        localStorage.setItem('arzaq_inventory', JSON.stringify(localProducts)); // Backup locally
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
    });
});

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

window.editQty = function(id) {
    let products = getProducts();
    const item = products.find(i => i.id === id);
    if(item) {
        const newQty = prompt(`تعديل الكمية الحالية لـ "${item.name}":`, item.qty);
        if(newQty !== null && !isNaN(newQty)) {
            const oldQty = item.qty;
            item.qty = parseInt(newQty);
            saveProducts(products);
            logAction(`✏️ تم تعديل كمية "${item.name}" يدوياً من ${oldQty} إلى ${item.qty}.`);
        }
    }
};

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
    { isUser: false, text: 'أهلاً بك! أنا المساعد الذكي. (أنا دلوقتي عندي ذاكرة وبفتكر كلامنا اللي فات!)' }
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

// أداة البحث وتوحيد النص
function normalizeText(text) {
    return text.replace(/[أإآا]/g, 'ا')
               .replace(/ة/g, 'ه')
               .toLowerCase().trim();
}

function findProduct(text, productsList) {
    let bestMatch = null;
    let highestScore = 0;
    const normalizedText = normalizeText(text);

    productsList.forEach(item => {
        let score = 0;
        let normalizedItemName = normalizeText(item.name);
        
        if (normalizedText.includes(normalizedItemName)) score += 10;

        let itemWords = normalizedItemName.split(' ');
        itemWords.forEach(word => {
            if (word.length > 2 && normalizedText.includes(word)) score += 3;
            if (word.endsWith('ه') && normalizedText.includes(word.slice(0, -1) + 'ات')) score += 3; // جمع ات
        });

        if (score > highestScore && score >= 3) {
            highestScore = score;
            bestMatch = item;
        }
    });

    return bestMatch;
}

// محرك فهم الأوامر (NLP Intent Engine)
function processAssistantCommand(text) {
    text = text.trim();
    if(!text) return;
    addMessage(text, true); // عرض ما قاله المستخدم

    const normText = normalizeText(text);
    let products = getProducts();
    let product = findProduct(text, products);
    
    // استخراج الأرقام من النص
    const numbers = text.match(/\d+/g);
    const amount = numbers ? parseInt(numbers[0]) : null;

    let reply = "عفواً، لم أفهم الأمر بشكل كامل.";

    // ------------------------------------------
    // 1. INTENT: عرض كل البضاعة
    // ------------------------------------------
    if (normText.match(/كل البضاعه|كل المنتجات|عرض الكل|اعرضلي كل/)) {
        if(products.length === 0) return sendReply("المخزون فارغ حالياً.");
        reply = "📦 المخزون:\n" + products.map(p => {
            const missing = Math.max(p.targetQty - p.qty, 0);
            return `- ${p.name}\nالموجود: ${p.qty} | المطلوب: ${p.targetQty} | السعر: ${p.price || 0} ج | الناقص: ${missing}`;
        }).join('\n\n');
        return sendReply(reply);
    }

    // ------------------------------------------
    // 2. INTENT: الاستعلام عن النواقص بشكل عام
    // ------------------------------------------
    if (normText.match(/ايه الناقص|المنتجات الناقصه|ايه النواقص|ايه اللي خلصان/)) {
        const shortages = products.filter(p => p.qty < p.targetQty);
        if (shortages.length > 0) {
            reply = "المنتجات الناقصة هي:\n" + shortages.map(p => `🔴 ${p.name} — ناقص ${p.targetQty - p.qty}`).join('\n');
        } else {
            reply = "لا توجد منتجات ناقصة، المخزون مكتمل بالكامل!";
        }
        return sendReply(reply);
    }

    // ------------------------------------------
    // 💡 منطق الذاكرة (Memory Logic) الذكي
    // ------------------------------------------
    // ------------------------------------------
    // 💡 منطق الذاكرة (Memory Logic) الذكي
    // ------------------------------------------
    let usedMemory = false;

    if (product) {
        // تحديث الذاكرة بالمنتج الجديد
        lastContextProductId = product.id;
        localStorage.setItem('arzaq_last_product_id', lastContextProductId);
    } else if (lastContextProductId) {
        // طريقة ذكية لمعرفة هل الكلام ده أمر تابع للمنتج اللي في الذاكرة ولا لأ
        // هنشيل كل الأرقام والكلمات المسموحة في الأوامر العادية، لو متبقاش حاجة غريبة (زي اسم منتج تاني) يبقى ده أمر للمنتج اللي في الذاكرة
        let padded = ' ' + normText.replace(/\d+/g, '') + ' ';
        const safeWords = [
            'طب','طيب','ماشي','لو','سمحت','بالله','عليك','بقولك','يا','سيدي','ممكن','عايز','عاوز',
            'علي','على','في','من','سعره','سعرها','السعر','سعر','كميته','كميتها','الكميه','كميه',
            'ليه','ليها','بتاعه','بتاعها','خلي','يخلي','جنيه','جنيها','قطعه','حته','عليهم','كمان',
            'بكام','كام','كم','موجود','زود','ضيف','اضف','حط','نقص','قلل','بعت','صرفت','بيع',
            'احذف','امسح','شيل','هل','ناقص','خلصان','بقي','بقى','دي','ده','دلوقتي','اللي','ال'
        ];
        
        safeWords.forEach(w => {
            const regex = new RegExp(`\\s${w}\\s`, 'g');
            padded = padded.replace(regex, ' ');
            padded = padded.replace(regex, ' '); // مرتين عشان الكلمات المتجاورة
        });
        
        const isPureCommand = (padded.trim() === '');
        
        if (isPureCommand || (padded.trim() === '' && amount !== null)) {
            product = products.find(p => p.id == lastContextProductId);
            if (product) usedMemory = true;
        }
    }

    // --- إذا لم يجد المنتج لا في النص ولا في الذاكرة ---
    if (!product) {
        // فحص إذا كان المستخدم يريد إضافة منتج جديد مباشرة من الشات
        if (normText.match(/^(?:ضيف|اضف|تسجيل|حط)\s+(?:منتج|صنف|قطعه|بضاعه)?/)) {
            // استخراج اسم المنتج والكمية والسعر
            let rawName = text.replace(/^(?:ضيف|اضف|تسجيل|حط)\s+(?:منتج|صنف|قطعه|بضاعه)?/i, '').trim();
            // فصل الأرقام لو وجدت
            let foundQty = 0;
            let foundPrice = null;
            let foundTarget = 10;
            
            if (numbers && numbers.length > 0) {
                foundQty = parseInt(numbers[0]);
                if (numbers.length > 1) {
                    foundPrice = parseInt(numbers[1]);
                }
                // تنظيف الاسم من الأرقام وكلمات زي (كمية، بسعر، قطع، جنيه)
                rawName = rawName.replace(/\d+/g, '')
                                 .replace(/كميه|كمية|بكمية|بكميه|عدد|قطع|قطعه|سعر|بسعر|جنيه|جنيها/g, '')
                                 .trim();
            }

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
                reply = "لإضافة منتج، يرجى كتابة اسمه بوضوح مثل: (ضيف منتج تيل فرامل 10 قطع بسعر 200).";
                return sendReply(reply);
            }
        } else if (lastContextProductId) {
            const memProd = products.find(p => p.id == lastContextProductId);
            reply = memProd 
                ? `لم أتعرف على اسم المنتج في كلامك.. هل تقصد "${memProd.name}"؟ لو أيوه، وضح الأمر زي (زود 5) أو (بكام).`
                : "لم أتعرف على اسم المنتج. يرجى التوضيح.";
        } else if (amount) {
            reply = "أنا فهمت الرقم، بس مش لاقي اسم المنتج في المخزون. اتأكد إنك كاتب اسم المنتج صح أو قولي (ضيف منتج " + text + ").";
        } else {
            reply = "لم أتعرف على اسم المنتج. يرجى التوضيح أو التأكد من إن المنتج موجود في المخزون.";
        }
        return sendReply(reply);
    }

    // إضافة توضيح بسيط لو استخدمنا الذاكرة عشان المساعد يوضح إنه فاكر
    const memoryHint = usedMemory ? `💡 بخصوص (${product.name}):\n` : "";

    // --- العمليات المرتبطة بالمنتج (المستخرج من النص أو الذاكرة) ---

    // ------------------------------------------
    // 2.5 INTENT: ضبط وتعديل الكمية مباشرة (SET QUANTITY)
    // ------------------------------------------
    if (normText.match(/خلي|خليه|خليهم|اضبط|ظبط|عدل الكميه|الكميه بقت/) && amount !== null && !normText.includes('سعر')) {
        const oldQty = product.qty;
        product.qty = amount;
        saveProducts(products);
        logAction(`✏️ قام المساعد بتعديل كمية "${product.name}" مباشرة من ${oldQty} إلى ${product.qty} قطعة.`);
        return sendReply(memoryHint + `✅ تم ضبط كمية ${product.name} مباشرة وأصبحت الآن ${product.qty} قطعة.`);
    }

    // ------------------------------------------
    // 3. INTENT: تعديل السعر
    // ------------------------------------------
    if (normText.includes('سعر') && amount !== null && !normText.match(/كام|كم|بكام/)) {
        let oldPrice = product.price || 0;
        if (normText.match(/زود|ضيف|اضف|حط/)) {
            product.price = oldPrice + amount;
            saveProducts(products);
            logAction(`💰 قام المساعد بزيادة سعر "${product.name}" من ${oldPrice} إلى ${product.price} جنيه.`);
            return sendReply(memoryHint + `تم تزويد السعر، وأصبح سعر ${product.name} دلوقتي ${product.price} جنيه.`);
        } else if (normText.match(/نقص|قلل/)) {
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
    if (normText.includes('سعر') || normText.includes('بكام')) {
        return sendReply(memoryHint + `سعر ${product.name} هو ${product.price || 'غير محدد'} جنيه.`);
    }

    // ------------------------------------------
    // 5. INTENT: زيادة الكمية (ADD)
    // ------------------------------------------
    if (normText.match(/زود|ضيف|اضف|حط/)) {
        if (amount) {
            product.qty += amount;
            saveProducts(products);
            logAction(`➕ قام المساعد بإضافة ${amount} قطعة إلى "${product.name}". (الإجمالي: ${product.qty})`);
            return sendReply(memoryHint + `تم إضافة ${amount} لـ ${product.name}.\nالكمية أصبحت ${product.qty}.`);
        } else {
            return sendReply(memoryHint + `عايز تزود كام قطعة من ${product.name}؟ قول الرقم.`);
        }
    }

    // ------------------------------------------
    // 6. INTENT: خصم الكمية (REMOVE)
    // ------------------------------------------
    if (normText.match(/نقص|قلل|بعت|صرفت|بيع/)) {
        if (amount) {
            if (product.qty >= amount) {
                product.qty -= amount;
                saveProducts(products); 
                const missing = Math.max(product.targetQty - product.qty, 0);
                logAction(`➖ قام المساعد بصرف ${amount} قطعة من "${product.name}". (المتبقي: ${product.qty})`);
                return sendReply(memoryHint + `تم خصم ${amount} من ${product.name}.\nالكمية أصبحت ${product.qty} من ${product.targetQty}، والناقص ${missing}.`);
            } else {
                return sendReply(memoryHint + `مش ممكن تخصم ${amount}. الموجود حاليًا من ${product.name} هو ${product.qty} فقط.`);
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
    processAssistantCommand(chatInput.value);
    chatInput.value = '';
});

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        processAssistantCommand(chatInput.value);
        chatInput.value = '';
    }
});

// ==========================================
// 6. Speech Recognition (المايكروفون)
// ==========================================
const micBtn = document.getElementById('mic-btn');
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = 'ar-EG';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = function() {
        micBtn.classList.add('recording');
        chatInput.placeholder = 'جاري الاستماع...';
    };

    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        chatInput.value = transcript;
        processAssistantCommand(transcript);
        chatInput.value = '';
    };

    recognition.onerror = function(event) {
        console.error('Speech recognition error', event.error);
        if(event.error === 'not-allowed') {
            addMessage('❌ المايك مقفول بسبب الحماية. شغل الموقع من ملف "تشغيل_الموقع.bat".', false, true);
        } else {
            addMessage('حدث خطأ في المايك، يرجى المحاولة مرة أخرى.', false, true);
        }
    };

    recognition.onend = function() {
        micBtn.classList.remove('recording');
        chatInput.placeholder = 'اكتب سؤالك أو أمرك هنا...';
    };

    micBtn.addEventListener('click', () => {
        if(chatbotBody.classList.contains('hidden')) {
            toggleChatBtn.click();
        }
        if(window.location.protocol === 'file:') {
            addMessage('⚠️ تنبيه: المايك مش هيشتغل وإنت فاتح الملف مباشرة. استخدم "تشغيل_الموقع.bat".', false, true);
        }
        recognition.start();
    });
} else {
    micBtn.style.display = 'none';
    console.log("Speech Recognition API not supported in this browser.");
}

// Init Application
renderChat();
updateUI();
