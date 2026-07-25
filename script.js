// ==========================================
// 1. CẤU HÌNH FIREBASE DỰ ÁN CHECKED-BOOKING
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyAdCjOVOGuAuvWUl6EkGJX_Eln_xIOWseo",
    authDomain: "checked-booking.firebaseapp.com",
    projectId: "checked-booking",
    storageBucket: "checked-booking.firebasestorage.app",
    messagingSenderId: "159538184252",
    appId: "1:159538184252:web:6de7849a629cfa5cb50339",
    measurementId: "G-8JVPYBPSG0"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ==========================================
// 2. XỬ LÝ LOGIC TRANG WEB
// ==========================================
document.addEventListener('DOMContentLoaded', function () {
    const noticeText = document.getElementById('notice-text');
    const zaloBtn = document.getElementById('btn-zalo');
    const qrModal = document.getElementById('qr-modal');
    const closeQrBtn = document.getElementById('close-qr');
    const messengerWidget = document.getElementById('messenger-widget');
    
    // Cập nhật đúng class selector cho nút chuyển tháng (thay đổi theo cấu trúc nút trong HTML của bạn)
    const prevMonthBtn = document.querySelector('.calendar-header button:first-child') || document.querySelector('.prev-month');
    const nextMonthBtn = document.querySelector('.calendar-header button:last-child') || document.querySelector('.next-month');
    const titleHeader = document.getElementById('calendar-title');

    let startDate = null;   // Ngày bắt đầu (YYYY-MM-DD)
    let endDate = null;     // Ngày kết thúc (YYYY-MM-DD)
    let selectedDates = []; // Danh sách các ngày được chọn
    let calendarCache = {}; // Lưu trữ tạm trạng thái từ Firebase

    let currentMonth = 8;
    let currentYear = 2026;

    // --- A. LẮNG NGHE DỮ LIỆU REALTIME TỪ FIRESTORE ---
    db.collection("calendar").onSnapshot((snapshot) => {
        const now = Date.now();

        snapshot.forEach((doc) => {
            const dateId = doc.id; // "2026-08-15"
            const data = doc.data();
            let status = data.status;

            // TỰ ĐỘNG NHẢ PHÒNG: Nếu quá 60 phút chưa duyệt -> Chuyển về available
            if (status === 'pending' && data.pending_until && data.pending_until < now) {
                status = 'available';
                db.collection("calendar").doc(dateId).set({ status: 'available' }, { merge: true });
            }

            calendarCache[dateId] = status;
        });

        // Cập nhật lại màu sắc lịch sau khi nhận dữ liệu mới
        updateCalendarDisplay();
    });

    // --- B. GÁN SỰ KIỆN CLICK CHO CÁC Ô LỊCH ---
    function attachCellClickEvents() {
        const calendarCells = document.querySelectorAll('.calendar-grid .day-cell:not(.day-header):not(.other-month)');

        calendarCells.forEach(cell => {
            cell.onclick = function () {
                // CHẶN NGAY: Nếu ngày này đã CÓ KHÁCH hoặc ĐANG CHỜ CỌC
                if (this.classList.contains('booked') || this.classList.contains('pending')) {
                    alert("Ngày này đã có khách đặt hoặc đang chờ xác nhận cọc, vui lòng chọn ngày khác!");
                    return;
                }

                const dateStr = this.getAttribute('data-date');
                if (!dateStr) return;

                // Xử lý chọn mốc đầu / mốc cuối
                if (startDate && endDate) {
                    startDate = dateStr;
                    endDate = null;
                } else if (!startDate) {
                    startDate = dateStr;
                } else {
                    const d1 = new Date(startDate);
                    const d2 = new Date(dateStr);
                    if (d2 < d1) {
                        endDate = startDate;
                        startDate = dateStr;
                    } else {
                        endDate = dateStr;
                    }
                }

                highlightRange();
            };
        });
    }

    // --- C. HÀM TÔ MÀU VÀ ĐỒNG BỘ HIỂN THỊ LỊCH ---
    function updateCalendarDisplay() {
        const calendarCells = document.querySelectorAll('.calendar-grid .day-cell:not(.day-header):not(.other-month)');

        calendarCells.forEach(cell => {
            const dateId = cell.getAttribute('data-date');
            cell.classList.remove('booked', 'pending', 'available', 'red', 'orange', 'blue');

            if (dateId && calendarCache[dateId]) {
                const status = calendarCache[dateId];
                if (status === 'booked') {
                    cell.classList.add('booked', 'red');
                } else if (status === 'pending') {
                    cell.classList.add('pending', 'orange');
                } else {
                    cell.classList.add('available');
                }
            } else {
                cell.classList.add('available');
            }
        });

        highlightRange();
        attachCellClickEvents();
    }

    // Tô màu các ngày nằm trong khoảng chọn
    function highlightRange() {
        const calendarCells = document.querySelectorAll('.calendar-grid .day-cell:not(.day-header):not(.other-month)');
        calendarCells.forEach(c => c.classList.remove('selected-day'));
        selectedDates = [];

        if (startDate && !endDate) {
            const cell = document.querySelector(`.day-cell[data-date="${startDate}"]`);
            if (cell) cell.classList.add('selected-day');
            selectedDates.push(startDate);

            if (noticeText) {
                noticeText.innerHTML = `<strong>Đã chọn ngày nhận phòng:</strong> ${formatDateView(startDate)}. Vui lòng nhấp chọn tiếp ngày trả phòng!`;
            }
        } else if (startDate && endDate) {
            let hasBookedOrPending = false;
            const startD = new Date(startDate);
            const endD = new Date(endDate);

            calendarCells.forEach(cell => {
                const cellDateStr = cell.getAttribute('data-date');
                if (cellDateStr) {
                    const cellD = new Date(cellDateStr);
                    // CHỈ TÔ MÀU KHI NGÀY ĐÓ CHÍNH XÁC NẰM TRONG KHOẢNG NĂM-THÁNG-NGÀY
                    if (cellD >= startD && cellD <= endD) {
                        cell.classList.add('selected-day');
                        selectedDates.push(cellDateStr);

                        if (cell.classList.contains('booked') || cell.classList.contains('pending')) {
                            hasBookedOrPending = true;
                        }
                    }
                }
            });

            if (noticeText) {
                if (hasBookedOrPending) {
                    noticeText.innerHTML = `<strong style="color:red;">Lưu ý:</strong> Trong khoảng chọn có ngày đã được đặt/chờ xác nhận. Vui lòng chọn khoảng khác!`;
                } else {
                    noticeText.innerHTML = `<strong>Bạn đã chọn ở từ:</strong> <strong>${formatDateView(startDate)}</strong> đến <strong>${formatDateView(endDate)}</strong> (${selectedDates.length} ngày). Bấm nút bên dưới để giữ chỗ ngay!`;
                }
            }
        }
    }

    function formatDateView(str) {
        if (!str) return '';
        const parts = str.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    // --- D. BẤM NÚT ĐẶT PHÒNG / GIỮ CHỖ CẢ KHOẢNG NGÀY ---
    if (zaloBtn) {
        zaloBtn.addEventListener('click', async function () {
            if (selectedDates.length === 0) {
                alert("Vui lòng nhấp chọn ngày nhận phòng và trả phòng trên lịch!");
                return;
            }

            let isBlocked = false;
            for (let d of selectedDates) {
                const docSnap = await db.collection("calendar").doc(d).get();
                if (docSnap.exists && docSnap.data().status === 'booked') {
                    isBlocked = true;
                    break;
                }
            }

            if (isBlocked) {
                alert("Trong khoảng thời gian bạn chọn có ngày đã có khách chốt cọc rồi. Vui lòng chọn khoảng ngày khác!");
                return;
            }

            const oneHourLater = Date.now() + (60 * 60 * 1000);
            const batch = db.batch();

            selectedDates.forEach(dateId => {
                const docRef = db.collection("calendar").doc(dateId);
                batch.set(docRef, {
                    status: 'pending',
                    pending_until: oneHourLater,
                    created_at: Date.now()
                }, { merge: true });
            });

            const bookingId = `${startDate}_to_${endDate}`;
            const bookingRef = db.collection("bookings").doc(bookingId);
            batch.set(bookingRef, {
                start_date: startDate,
                end_date: endDate,
                dates: selectedDates,
                status: 'pending',
                pending_until: oneHourLater,
                created_at: Date.now()
            });

            await batch.commit();

            if (qrModal) {
                qrModal.classList.add('active');
                qrModal.style.display = 'flex';
            }
        });
    }

    // --- E. ĐÓNG MODAL QR & FLOATING WIDGET ---
    if (closeQrBtn) {
        closeQrBtn.addEventListener('click', function () {
            if (qrModal) {
                qrModal.classList.remove('active');
                qrModal.style.display = 'none';
            }
        });
    }

    if (qrModal) {
        qrModal.addEventListener('click', function (e) {
            if (e.target === qrModal) {
                qrModal.classList.remove('active');
                qrModal.style.display = 'none';
            }
        });
    }

    if (messengerWidget) {
        messengerWidget.addEventListener('click', function () {
            window.open('https://zalo.me/0901234567', '_blank');
        });
    }

    // --- F. TỰ ĐỘNG TẠO LỊCH & CHUYỂN THÁNG CHUẨN ---
    function renderCalendar(month, year) {
        if (titleHeader) titleHeader.innerText = `Tháng ${month}, ${year}`;

        // Lấy ngày đầu tiên và số ngày của tháng
        const firstDay = new Date(year, month - 1, 1).getDay();
        const daysInMonth = new Date(year, month, 0).getDate();

        const grid = document.querySelector('.calendar-grid');
        if (!grid) return;

        // Giữ lại các tiêu đề Thứ (Sun, Mon, Tue...)
        const headers = Array.from(grid.querySelectorAll('.day-header'));
        grid.innerHTML = '';
        headers.forEach(h => grid.appendChild(h));

        // Thêm ô trống cho các ngày thuộc tháng trước
        for (let i = 0; i < firstDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'day-cell other-month';
            grid.appendChild(emptyCell);
        }

        // Lấy mốc thời gian hiện tại (đưa về 00:00:00 để so sánh chính xác theo ngày)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Tạo các ô ngày trong tháng VỚI DATA-DATE CHUẨN (YYYY-MM-DD)
        for (let day = 1; day <= daysInMonth; day++) {
            const cell = document.createElement('div');
            cell.className = 'day-cell';

            // Format dạng YYYY-MM-DD chuẩn mực
            const mStr = String(month).padStart(2, '0');
            const dStr = String(day).padStart(2, '0');
            const fullDate = `${year}-${mStr}-${dStr}`;

            cell.setAttribute('data-date', fullDate);
            cell.innerText = day;

            // --- ĐOẠN KIỂM TRA VÀ KHÓA CÁC NGÀY TRONG QUÁ KHỨ ---
            const cellDate = new Date(year, month - 1, day);
            cellDate.setHours(0, 0, 0, 0);

            if (cellDate < today) {
                cell.classList.add('past-date');
                cell.style.opacity = '0.3';       // Làm mờ ngày cũ đi
                cell.style.pointerEvents = 'none'; // Chặn hoàn toàn không cho click
                cell.style.cursor = 'not-allowed';
            }

            grid.appendChild(cell);
        }

        // Cập nhật lại màu sắc từ Firebase & gán sự kiện click
        updateCalendarDisplay();
    }

    // Sự kiện bấm nút Chuyển tháng
    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', function () {
            if (currentMonth === 1) { currentMonth = 12; currentYear--; } else { currentMonth--; }
            renderCalendar(currentMonth, currentYear);
        });
    }

    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', function () {
            if (currentMonth === 12) { currentMonth = 1; currentYear++; } else { currentMonth++; }
            renderCalendar(currentMonth, currentYear);
        });
    }

    // Khởi tạo lịch lần đầu tiên đúng theo Tháng 8/2026
    renderCalendar(currentMonth, currentYear);
});