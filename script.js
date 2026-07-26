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

// Khởi tạo Firebase & Firestore
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// ==========================================
// 2. XỬ LÝ LOGIC TRANG WEB
// ==========================================
document.addEventListener('DOMContentLoaded', function () {
    const zaloBtn = document.getElementById('btn-zalo');
    const qrModal = document.getElementById('qr-modal');
    const closeQrBtn = document.getElementById('close-qr');
    const messengerWidget = document.getElementById('messenger-widget');

    // Modal thông báo thành công Zalo
    const zaloSuccessModal = document.getElementById('zalo-success-modal');
    const closeZaloSuccessBtn = document.getElementById('close-zalo-success');

    // Selector nút chuyển tháng
    const prevMonthBtn = document.querySelector('.calendar-header button:first-child') || document.querySelector('.prev-month');
    const nextMonthBtn = document.querySelector('.calendar-header button:last-child') || document.querySelector('.next-month');
    const titleHeader = document.getElementById('calendar-title');

    let startDate = null;   // Ngày bắt đầu (YYYY-MM-DD)
    let endDate = null;     // Ngày kết thúc (YYYY-MM-DD)
    let selectedDates = []; // Danh sách các ngày được chọn
    let calendarCache = {}; // Lưu trữ tạm trạng thái từ Firebase

    const todayNow = new Date();
    let currentMonth = todayNow.getMonth() + 1; // getMonth() trả về 0-11
    let currentYear = todayNow.getFullYear();

    // --- HÀM CẬP NHẬT GIAO DIỆN KHUNG THÔNG BÁO ---
    function updateNoticeDisplay(start, end, totalDays, hasError = false) {
        const defaultBox = document.getElementById('notice-default');
        const selectedBox = document.getElementById('notice-selected');
        const dateRangeEl = document.getElementById('display-date-range');
        const totalDaysEl = document.getElementById('display-total-days');

        if (!defaultBox || !selectedBox) return;

        if (start && totalDays > 0) {
            let rangeText = formatDateView(start);
            if (end && end !== start) {
                rangeText += ` ➔ ${formatDateView(end)}`;
            }

            if (dateRangeEl) dateRangeEl.innerText = rangeText;
            if (totalDaysEl) totalDaysEl.innerText = totalDays;

            defaultBox.style.display = 'none';
            selectedBox.style.display = 'block';

            if (hasError) {
                selectedBox.classList.remove('notice-success');
                selectedBox.classList.add('notice-warning');
                selectedBox.style.backgroundColor = '#fef2f2';
                selectedBox.style.borderColor = '#fecaca';
                selectedBox.style.color = '#dc2626';
            } else {
                selectedBox.classList.remove('notice-warning');
                selectedBox.classList.add('notice-success');
                selectedBox.style.backgroundColor = '#f0fdf4';
                selectedBox.style.borderColor = '#bbf7d0';
                selectedBox.style.color = '#166534';
            }
        } else {
            defaultBox.style.display = 'block';
            selectedBox.style.display = 'none';
        }
    }

    // --- A. LẮNG NGHE DỮ LIỆU REALTIME TỪ FIRESTORE ---
    db.collection("calendar").onSnapshot((snapshot) => {
        const now = Date.now();

        snapshot.forEach((doc) => {
            const dateId = doc.id; // "2026-08-15"
            const data = doc.data();
            let status = data.status;

            // TỰ ĐỘNG NHẢ PHÒNG: Quá 60 phút chưa duyệt -> Chuyển về available
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
        const calendarCells = document.querySelectorAll('.calendar-grid .day-cell:not(.day-header):not(.other-month):not(.past-date)');

        calendarCells.forEach(cell => {
            cell.onclick = function () {
                const dateStr = this.getAttribute('data-date');
                if (!dateStr) return;

                // 1. Chặn chọn mốc đầu (startDate) rơi vào ngày đã booked/pending
                if (!startDate || (startDate && endDate)) {
                    if (this.classList.contains('booked') || this.classList.contains('pending')) {
                        alert("Ngày này đã có khách đặt hoặc đang chờ xác nhận, vui lòng chọn ngày khác!");
                        return;
                    }
                    startDate = dateStr;
                    endDate = null;
                } else {
                    // 2. Đã có startDate, tiến hành chọn endDate
                    let d1 = new Date(startDate);
                    let d2 = new Date(dateStr);

                    if (d2 < d1) {
                        // Nếu chọn ngày kết thúc bé hơn ngày bắt đầu -> Đổi thành startDate mới
                        if (this.classList.contains('booked') || this.classList.contains('pending')) {
                            alert("Ngày này đã có khách đặt hoặc đang chờ xác nhận, vui lòng chọn ngày khác!");
                            return;
                        }
                        startDate = dateStr;
                        endDate = null;
                    } else if (d2.getTime() === d1.getTime()) {
                        // Click lại đúng ngày bắt đầu -> Giữ nguyên chọn 1 ngày
                        endDate = null;
                    } else {
                        // Đặt endDate
                        let targetEndDate = dateStr;

                        // Kiểm tra khoảng giữa startDate và endDate có dính ngày bận không
                        if (checkRangeHasBlockedDays(startDate, targetEndDate)) {
                            alert("Trong khoảng thời gian bạn chọn có ngày đã được khách khác giữ chỗ/đặt phòng. Vui lòng chọn khoảng ngày khác!");
                            return;
                        }

                        endDate = targetEndDate;
                    }
                }

                highlightRange();
            };
        });
    }

    // Kiểm tra xem từ startStr đến trước endStr có chứa ngày bị khoá không
    function checkRangeHasBlockedDays(startStr, endStr) {
        let curr = new Date(startStr);
        const endD = new Date(endStr);

        curr.setHours(0, 0, 0, 0);
        endD.setHours(0, 0, 0, 0);

        // Kiểm tra các đêm lưu trú (từ startDate tới trước endDate)
        while (curr < endD) {
            const mStr = String(curr.getMonth() + 1).padStart(2, '0');
            const dStr = String(curr.getDate()).padStart(2, '0');
            const formattedDate = `${curr.getFullYear()}-${mStr}-${dStr}`;

            const status = calendarCache[formattedDate];
            if (status === 'booked' || status === 'pending') {
                return true; // Có ngày bị vướng
            }

            curr.setDate(curr.getDate() + 1);
        }

        return false;
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
            // Mới chọn 1 ngày
            const cell = document.querySelector(`.day-cell[data-date="${startDate}"]`);
            if (cell) cell.classList.add('selected-day');
            selectedDates.push(startDate);

            updateNoticeDisplay(startDate, null, 1);

        } else if (startDate && endDate) {
            const startD = new Date(startDate);
            const endD = new Date(endDate);

            startD.setHours(0, 0, 0, 0);
            endD.setHours(0, 0, 0, 0);

            calendarCells.forEach(cell => {
                const cellDateStr = cell.getAttribute('data-date');
                if (cellDateStr) {
                    const cellD = new Date(cellDateStr);
                    cellD.setHours(0, 0, 0, 0);

                    // Tô màu các ngày nằm trong khoảng chọn
                    if (cellD >= startD && cellD <= endD) {
                        cell.classList.add('selected-day');
                        selectedDates.push(cellDateStr);
                    }
                }
            });

            // Tính số đêm lưu trú
            const timeDiff = Math.abs(endD - startD);
            const totalNights = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)) || 1;

            updateNoticeDisplay(startDate, endDate, totalNights, false);

        } else {
            updateNoticeDisplay(null, null, 0);
        }
    }

    function formatDateView(str) {
        if (!str) return '';
        const parts = str.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    // --- D. BẤM NÚT "LIÊN HỆ QUA ZALO" -> MỞ MODAL ĐIỀN THÔNG TIN ---
    if (zaloBtn) {
        zaloBtn.addEventListener('click', function () {
            if (selectedDates.length === 0) {
                alert("Vui lòng nhấp chọn ngày nhận phòng và trả phòng trên lịch!");
                return;
            }

            if (qrModal) {
                qrModal.classList.add('active');
                qrModal.style.display = 'flex';
            }
        });
    }

    // --- E. BẤM NÚT "GỬI THÔNG TIN ĐẶT PHÒNG" ---
    const confirmBookingBtn = document.getElementById('btn-confirm-booking');

    if (confirmBookingBtn) {
        confirmBookingBtn.addEventListener('click', async function () {
            const nameInput = document.getElementById('customer-name');
            const phoneInput = document.getElementById('customer-phone');

            const customerName = nameInput ? nameInput.value.trim() : '';
            const customerPhone = phoneInput ? phoneInput.value.trim() : '';

            if (!customerName) {
                alert("Vui lòng nhập Họ và tên của bạn!");
                if (nameInput) nameInput.focus();
                return;
            }

            if (!customerPhone) {
                alert("Vui lòng nhập Số điện thoại/Zalo liên hệ!");
                if (phoneInput) phoneInput.focus();
                return;
            }

            // Đảm bảo không lưu đè lên đêm trả phòng (chỉ lưu các đêm thực sự ở lại)
            let datesToHold = [...selectedDates];
            if (startDate && endDate && selectedDates.length > 1) {
                datesToHold = selectedDates.filter(d => d !== endDate);
            }

            // Kiểm tra realtime lại một lần nữa trước khi ghi database
            let isBlocked = false;
            for (let d of datesToHold) {
                const docSnap = await db.collection("calendar").doc(d).get();
                if (docSnap.exists && docSnap.data().status === 'booked') {
                    isBlocked = true;
                    break;
                }
            }

            if (isBlocked) {
                alert("Trong khoảng thời gian bạn chọn đã có khách chốt phòng rồi. Vui lòng chọn ngày khác!");
                return;
            }

            const oneHourLater = Date.now() + (60 * 60 * 1000);
            const batch = db.batch();

            // Lưu trạng thái pending cho các đêm lưu trú
            datesToHold.forEach(dateId => {
                const docRef = db.collection("calendar").doc(dateId);
                batch.set(docRef, {
                    status: 'pending',
                    customer_name: customerName,
                    customer_phone: customerPhone,
                    pending_until: oneHourLater,
                    created_at: Date.now()
                }, { merge: true });
            });

            // Lưu đơn giữ chỗ vào collection bookings
            const bookingId = `${startDate}_to_${endDate || startDate}`;
            const bookingRef = db.collection("bookings").doc(bookingId);
            batch.set(bookingRef, {
                start_date: startDate,
                end_date: endDate || startDate,
                customer_name: customerName,
                customer_phone: customerPhone,
                dates: datesToHold,
                status: 'pending',
                pending_until: oneHourLater,
                created_at: Date.now()
            });

            await batch.commit();

            // 1. Đóng Modal điền thông tin
            if (qrModal) {
                qrModal.classList.remove('active');
                qrModal.style.display = 'none';
            }

            // 2. Mở Popup thông báo thành công
            if (zaloSuccessModal) {
                zaloSuccessModal.classList.add('active');
                zaloSuccessModal.style.display = 'flex';
            }
        });
    }

    // --- F. ĐÓNG MODALS & FLOATING WIDGET ---
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

    if (closeZaloSuccessBtn) {
        closeZaloSuccessBtn.addEventListener('click', function () {
            if (zaloSuccessModal) {
                zaloSuccessModal.classList.remove('active');
                zaloSuccessModal.style.display = 'none';
            }
        });
    }

    if (zaloSuccessModal) {
        zaloSuccessModal.addEventListener('click', function (e) {
            if (e.target === zaloSuccessModal) {
                zaloSuccessModal.classList.remove('active');
                zaloSuccessModal.style.display = 'none';
            }
        });
    }

    if (messengerWidget) {
        messengerWidget.addEventListener('click', function () {
            window.open('https://www.facebook.com/tunihousehomestaylagi', '_blank');
        });
    }

    // --- G. TỰ ĐỘNG TẠO LỊCH & CHUYỂN THÁNG CHUẨN ---
    function renderCalendar(month, year) {
        if (titleHeader) titleHeader.innerText = `Tháng ${month}, ${year}`;

        const firstDay = new Date(year, month - 1, 1).getDay();
        const daysInMonth = new Date(year, month, 0).getDate();

        const grid = document.querySelector('.calendar-grid');
        if (!grid) return;

        // Giữ lại tiêu đề các Thứ (Sun, Mon, Tue...)
        const headers = Array.from(grid.querySelectorAll('.day-header'));
        grid.innerHTML = '';
        headers.forEach(h => grid.appendChild(h));

        // Thêm ô trống cho ngày thuộc tháng trước
        for (let i = 0; i < firstDay; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'day-cell other-month';
            grid.appendChild(emptyCell);
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Tạo các ô ngày YYYY-MM-DD
        for (let day = 1; day <= daysInMonth; day++) {
            const cell = document.createElement('div');
            cell.className = 'day-cell';

            const mStr = String(month).padStart(2, '0');
            const dStr = String(day).padStart(2, '0');
            const fullDate = `${year}-${mStr}-${dStr}`;

            cell.setAttribute('data-date', fullDate);
            cell.innerText = day;

            // Khóa ngày trong quá khứ
            const cellDate = new Date(year, month - 1, day);
            cellDate.setHours(0, 0, 0, 0);

            if (cellDate < today) {
                cell.classList.add('past-date');
                cell.style.opacity = '0.3';
                cell.style.pointerEvents = 'none';
                cell.style.cursor = 'not-allowed';
            }

            grid.appendChild(cell);
        }

        updateCalendarDisplay();
    }

    // Nút chuyển tháng
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

    // Khởi tạo lịch mặc định
    renderCalendar(currentMonth, currentYear);
});