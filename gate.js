/**
 * Access gate — blocks the app for anyone opening the page directly.
 * Reveals the app only after the correct 4-digit code is entered.
 * Once unlocked, the session is remembered so it isn't re-gated on reload.
 */
(function () {
    var ACCESS_CODE = '5234';
    var STORAGE_KEY = 'mailstream_access_granted';

    var gate = document.getElementById('access-gate');
    if (!gate) return;

    // Already unlocked this session? Remove the gate and carry on.
    try {
        if (sessionStorage.getItem(STORAGE_KEY) === '1') {
            document.body.classList.remove('gated');
            gate.remove();
            return;
        }
    } catch (e) { /* private mode — just show the gate */ }

    // Lock scrolling behind the gate.
    document.body.style.overflow = 'hidden';

    var continueLink = document.getElementById('gate-continue-link');
    var pinModal = document.getElementById('gate-pin-modal');
    var pinClose = document.getElementById('gate-pin-close');
    var pinForm = document.getElementById('gate-pin-form');
    var pinInput = document.getElementById('gate-pin-input');
    var pinError = document.getElementById('gate-pin-error');

    function openPinModal() {
        pinModal.hidden = false;
        pinError.textContent = '';
        pinInput.value = '';
        pinInput.focus();
    }
    function closePinModal() {
        pinModal.hidden = true;
    }

    continueLink.addEventListener('click', openPinModal);
    pinClose.addEventListener('click', closePinModal);
    pinModal.addEventListener('click', function (e) {
        if (e.target === pinModal) closePinModal();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !pinModal.hidden) closePinModal();
    });

    // Digits only.
    pinInput.addEventListener('input', function () {
        pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 4);
        pinError.textContent = '';
    });

    pinForm.addEventListener('submit', function (e) {
        e.preventDefault();
        if (pinInput.value === ACCESS_CODE) {
            try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch (err) { /* ignore */ }
            document.body.classList.remove('gated');
            document.body.style.overflow = '';
            gate.classList.add('gate-hide');
            setTimeout(function () { gate.remove(); }, 300);
        } else {
            pinError.textContent = 'Incorrect code. Please try again.';
            pinInput.value = '';
            pinInput.focus();
        }
    });
})();
