/* ===================================   SISTEMA DE LOGIN - LÓGICA DE AUTENTICACIÓN
   Conectado con Supabase y sistema de roles
   =================================== */

// ===================================
// CONFIGURACIÓN GLOBAL
// ===================================

const supabase = window.API;

// Variables globales
let isLoading = false;
let validationTimeout = null;

// ===================================
// INICIALIZACIÓN
// ===================================

document.addEventListener('DOMContentLoaded', function () {
    console.log('🔐 Sistema de login inicializado');

    // Verificar si ya hay una sesión activa
    checkExistingSession();

    // Configurar eventos del formulario
    setupFormEvents();

    // Configurar validaciones en tiempo real
    setupRealtimeValidation();

    // Configurar efectos visuales
    setupVisualEffects();

    // Focus automático en el campo username
    const usernameInput = document.getElementById('username');
    if (usernameInput) {
        setTimeout(() => usernameInput.focus(), 500);
    }
});

// ===================================
// VERIFICACIÓN DE SESIÓN EXISTENTE
// ===================================

async function checkExistingSession() {
    // Ya no verificamos sesiones guardadas automáticamente
    return;
}
// ===================================
// CONFIGURACIÓN DE EVENTOS
// ===================================

function setupFormEvents() {
    const form = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');

    // Evento de submit del formulario
    form.addEventListener('submit', handleLogin);

    // Eventos de teclado para mejorar UX
    usernameInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            passwordInput.focus();
        }
    });

    passwordInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            form.dispatchEvent(new Event('submit'));
        }
    });

    // Limpiar mensajes al empezar a escribir
    [usernameInput, passwordInput].forEach(input => {
        input.addEventListener('input', function () {
            clearMessage();
            clearFieldValidation(this);
        });
    });
}

function setupRealtimeValidation() {
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');

    // Validación de username
    usernameInput.addEventListener('input', function () {
        clearTimeout(validationTimeout);
        validationTimeout = setTimeout(() => {
            validateUsername(this.value);
        }, 500);
    });

    // Validación de password
    passwordInput.addEventListener('input', function () {
        validatePassword(this.value);
    });
}

function setupVisualEffects() {
    // Efecto de parallax suave en elementos decorativos
    document.addEventListener('mousemove', function (e) {
        const decorations = document.querySelectorAll('.bg-decoration');
        const mouseX = e.clientX / window.innerWidth;
        const mouseY = e.clientY / window.innerHeight;

        decorations.forEach((decoration, index) => {
            const speed = (index + 1) * 0.5;
            const x = (mouseX - 0.5) * speed * 20;
            const y = (mouseY - 0.5) * speed * 20;

            decoration.style.transform = `translate(${x}px, ${y}px)`;
        });
    });
}

// ===================================
// MANEJO DEL LOGIN
// ===================================

async function handleLogin(e) {
    e.preventDefault();

    if (isLoading) return;

    const formData = new FormData(e.target);
    const username = formData.get('username').trim();
    const password = formData.get('password');

    // Validaciones básicas
    if (!validateForm(username, password)) {
        return;
    }

    // Mostrar estado de carga
    setLoadingState(true);

    try {
        // Intentar autenticación
        const user = await authenticateUser(username, password);

        if (user) {
            // Login exitoso
            console.log('✅ Login exitoso:', user.nombre);

            // Guardar sesión
            await saveUserSession(user);

            // Mostrar mensaje de éxito
            showSuccessMessage(`¡Bienvenido, ${user.nombre}!`);

            // Animación de éxito
            document.querySelector('.login-card').classList.add('success');

            // Redirigir después de un breve delay
            setTimeout(() => {
                redirectToApp(user);
            }, 2000);

        } else {
            // Credenciales inválidas - mensaje más específico
            if (error && error.code === 'PGRST116') {
                showErrorMessage('Usuario no encontrado en el sistema');
            } else {
                showErrorMessage('Usuario o contraseña incorrectos');
            }
            shakeCard();
        }

    } catch (error) {
        console.error('❌ Error durante el login:', error);
        showErrorMessage('Error de conexión. Intenta nuevamente.');
        shakeCard();

    } finally {
        setLoadingState(false);
    }
}

// ===================================
// AUTENTICACIÓN CON SUPABASE
// ===================================

async function authenticateUser(username, password) {
    try {
        console.log('🔍 Intentando autenticar usuario:', username);

        // QUERY SIMPLIFICADA - Solo tabla usuarios
        const { data: usuario, error: userError } = await supabase
            .from('usuarios')
            .select('*')
            .eq('username', username)
            .eq('activo', true)
            .single();

        if (userError) {
            console.error('Error buscando usuario:', userError);
            return null;
        }

        if (!usuario) {
            console.log('❌ Usuario no encontrado');
            return null;
        }

        // Verificar contraseña (comparación directa para desarrollo)
        if (usuario.password_hash !== password) {
            console.log('❌ Contraseña incorrecta');
            return null;
        }

        // QUERY SEPARADA - Buscar rol
        const { data: rol, error: rolError } = await supabase
            .from('roles')
            .select('nombre, descripcion, permisos')
            .eq('id', usuario.rol_id)
            .single();

        if (rolError) {
            console.warn('Error cargando rol:', rolError);
            // Continuar sin rol si hay error
        }

        // Actualizar última fecha de login
        await supabase
            .from('usuarios')
            .update({ fecha_ultimo_login: new Date().toISOString() })
            .eq('id', usuario.id);

        console.log('✅ Usuario autenticado exitosamente');

        return {
            id: usuario.id,
            username: usuario.username,
            nombre: usuario.nombre,
            departamento: usuario.departamento,
            rol_id: usuario.rol_id,
            rol: rol?.nombre || 'usuario',
            permisos: rol?.permisos || {},
            token_disponible: usuario.token_disponible
        };

    } catch (error) {
        console.error('Error en authenticateUser:', error);
        throw error;
    }
}

// ===================================
// GESTIÓN DE SESIONES
// ===================================

async function saveUserSession(user) {
    // Solo guardar en sessionStorage para la sesión actual
    sessionStorage.setItem('currentUser', JSON.stringify(user));
    
    console.log('💾 Sesión guardada:', { username: user.username });
}

function redirectToApp(user) {
    // Determinar página de destino según el rol
    let targetPage = 'index.html'; // Default para usuarios normales

    switch (user.rol) {
        case 'super_admin':
            targetPage = 'admin.html';
            break;
        case 'admin':
            targetPage = 'admin.html';
            break;
        case 'usuario':
        default:
            targetPage = 'index.html';
            break;
    }

    console.log(`🚀 Redirigiendo a: ${targetPage} (rol: ${user.rol})`);

    // SOLUCIÓN: Redirigir directamente sin verificar con fetch
    window.location.href = targetPage;
}

// ===================================
// VALIDACIONES
// ===================================

function validateForm(username, password) {
    let isValid = true;

    // Validar username
    if (!username || username.length < 3) {
        showFieldError('username', 'El usuario debe tener al menos 3 caracteres');
        isValid = false;
    }

    // Validar password
    if (!password || password.length < 3) {
        showFieldError('password', 'La contraseña es requerida');
        isValid = false;
    }

    return isValid;
}

async function validateUsername(username) {
    const container = document.getElementById('username').closest('.input-container');

    if (!username || username.length < 3) {
        container.classList.remove('valid', 'invalid');
        return;
    }

    try {
        // Verificar si el username existe
        const { data, error } = await supabase
            .from('usuarios')
            .select('username')
            .eq('username', username)
            .eq('activo', true)
            .single();

        if (data) {
            container.classList.add('valid');
            container.classList.remove('invalid');
        } else {
            container.classList.add('invalid');
            container.classList.remove('valid');
        }
    } catch (error) {
        container.classList.remove('valid', 'invalid');
    }
}

function validatePassword(password) {
    const container = document.getElementById('password').closest('.input-container');

    if (!password) {
        container.classList.remove('valid', 'invalid');
        return;
    }

    if (password.length >= 3) {
        container.classList.add('valid');
        container.classList.remove('invalid');
    } else {
        container.classList.add('invalid');
        container.classList.remove('valid');
    }
}

// ===================================
// FUNCIONES DE UI
// ===================================

function setLoadingState(loading) {
    isLoading = loading;
    const loginButton = document.getElementById('loginButton');
    const buttonText = loginButton.querySelector('.button-text');
    const buttonLoader = loginButton.querySelector('.button-loader');
    const form = document.getElementById('loginForm');
    const card = document.querySelector('.login-card');

    if (loading) {
        loginButton.disabled = true;
        buttonText.style.display = 'none';
        buttonLoader.style.display = 'flex';
        form.style.pointerEvents = 'none';
        card.classList.add('loading');
    } else {
        loginButton.disabled = false;
        buttonText.style.display = 'inline';
        buttonLoader.style.display = 'none';
        form.style.pointerEvents = 'auto';
        card.classList.remove('loading');
    }
}

function showMessage(message, type) {
    const container = document.getElementById('messageContainer');
    const text = container.querySelector('.message-text');

    container.className = `message-container ${type}`;
    text.textContent = message;
    container.style.display = 'block';

    // Auto-hide después de 5 segundos para mensajes de error
    if (type === 'error' || type === 'warning') {
        setTimeout(() => {
            clearMessage();
        }, 5000);
    }
}

function showSuccessMessage(message) {
    showMessage(message, 'success');
}

function showErrorMessage(message) {
    showMessage(message, 'error');
}

function showWarningMessage(message) {
    showMessage(message, 'warning');
}

function clearMessage() {
    const container = document.getElementById('messageContainer');
    container.style.display = 'none';
}

function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const container = field.closest('.input-container');

    container.classList.add('invalid');
    container.classList.remove('valid');

    // Crear tooltip de error
    let errorTooltip = container.querySelector('.error-tooltip');
    if (!errorTooltip) {
        errorTooltip = document.createElement('div');
        errorTooltip.className = 'error-tooltip';
        container.appendChild(errorTooltip);
    }

    errorTooltip.textContent = message;
    errorTooltip.style.display = 'block';

    // Auto-hide después de 3 segundos
    setTimeout(() => {
        if (errorTooltip) {
            errorTooltip.style.display = 'none';
        }
    }, 3000);
}

function clearFieldValidation(field) {
    const container = field.closest('.input-container');
    const errorTooltip = container.querySelector('.error-tooltip');

    container.classList.remove('valid', 'invalid');

    if (errorTooltip) {
        errorTooltip.style.display = 'none';
    }
}

function shakeCard() {
    const card = document.querySelector('.login-card');
    card.style.animation = 'shake 0.5s ease-in-out';

    setTimeout(() => {
        card.style.animation = '';
    }, 500);
}

// ===================================
// FUNCIONES DE UTILIDAD
// ===================================

function togglePassword() {
    const passwordInput = document.getElementById('password');
    const eyeIcon = document.querySelector('.password-toggle .eye-icon');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.innerHTML = `
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94l9.88 9.88z"/>
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19l-6.84-6.84z"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
            <circle cx="12" cy="12" r="3"/>
        `;
    } else {
        passwordInput.type = 'password';
        eyeIcon.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
        `;
    }
}

function showForgotPassword() {
    showWarningMessage('Funcionalidad de recuperación de contraseña próximamente disponible. Contacta al administrador.');
}

// ===================================
// MANEJO DE ERRORES GLOBAL
// ===================================

window.addEventListener('error', function (e) {
    console.error('Error global en login:', e.error);
    if (isLoading) {
        setLoadingState(false);
        showErrorMessage('Ha ocurrido un error inesperado');
    }
});

window.addEventListener('unhandledrejection', function (e) {
    console.error('Promise rechazada en login:', e.reason);
    if (isLoading) {
        setLoadingState(false);
        showErrorMessage('Error de conexión con el servidor');
    }
});

// ===================================
// ESTILOS CSS DINÁMICOS
// ===================================

// Agregar estilos adicionales para tooltips de error
const additionalStyles = document.createElement('style');
additionalStyles.textContent = `
    .error-tooltip {
        position: absolute;
        bottom: -35px;
        left: 0;
        background: var(--color-danger);
        color: white;
        padding: 0.5rem 0.75rem;
        border-radius: 6px;
        font-size: 0.8rem;
        white-space: nowrap;
        z-index: 10;
        display: none;
        animation: slideInUp 0.3s ease;
    }
    
    .error-tooltip::before {
        content: '';
        position: absolute;
        top: -5px;
        left: 1rem;
        width: 0;
        height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-bottom: 5px solid var(--color-danger);
    }
    
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
        20%, 40%, 60%, 80% { transform: translateX(5px); }
    }
    
    @keyframes slideInUp {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(additionalStyles);

// También agregar función para verificar autenticación en otras páginas
function checkAuthentication() {
    const currentPage = window.location.pathname;

    // Solo verificar en páginas que requieren autenticación
    const protectedPages = ['/index.html', '/historial.html', '/admin/'];
    const needsAuth = protectedPages.some(page => currentPage.includes(page)) || currentPage === '/';

    if (!needsAuth) return true;

    try {
        const session = sessionStorage.getItem('currentUser');
        if (!session) {
            console.log('No hay sesión activa, redirigiendo al login');
            window.location.href = '/login.html';
            return false;
        }

        const user = JSON.parse(session);
        console.log('Usuario autenticado:', user.nombre);
        return user;

    } catch (error) {
        console.error('Error verificando autenticación:', error);
        window.location.href = '/login.html';
        return false;
    }
}

// Función de logout
function logout() {
    sessionStorage.removeItem('currentUser');
    // Ya no necesitamos limpiar localStorage
    window.location.href = '/login.html';
}