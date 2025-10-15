/* ===================================
   SISTEMA DE NOTIFICACIONES CON SONIDO
   Genera sonidos usando Web Audio API
   =================================== */

let audioActivado = true;
let tipoSonidoNotificacion = 'chime'; // Opciones: 'beep', 'chime', 'alert', 'bell', 'success'

// Variable para saber si el audio ya fue desbloqueado
let audioDesbloqueado = false;

// Función para desbloquear audio (se ejecuta al primer click)
function desbloquearAudio() {
    if (audioDesbloqueado) return;
    
    try {
        const contexto = new (window.AudioContext || window.webkitAudioContext)();
        const buffer = contexto.createBuffer(1, 1, 22050);
        const source = contexto.createBufferSource();
        source.buffer = buffer;
        source.connect(contexto.destination);
        source.start(0);
        
        audioDesbloqueado = true;
        console.log('🔊 Audio desbloqueado - Listo para notificaciones');
    } catch (error) {
        console.error('Error desbloqueando audio:', error);
    }
}

// Desbloquear audio con el primer click/tecla en la página
document.addEventListener('click', desbloquearAudio, { once: true });
document.addEventListener('keydown', desbloquearAudio, { once: true });

/**
 * Función principal para reproducir sonido de notificación
 */
window.reproducirSonidoNotificacion = function(tipoSonido = null) {
    if (!audioActivado) {
        console.log('🔇 Audio desactivado');
        return;
    }
    
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContext();
        
        const tipo = tipoSonido || tipoSonidoNotificacion;
        
        switch(tipo) {
            case 'beep':
                reproducirBeep(audioCtx);
                break;
            case 'chime':
                reproducirChime(audioCtx);
                break;
            case 'alert':
                reproducirAlert(audioCtx);
                break;
            case 'bell':
                reproducirBell(audioCtx);
                break;
            case 'success':
                reproducirSuccess(audioCtx);
                break;
            default:
                reproducirChime(audioCtx);
        }
        
        console.log('🔊 Sonido reproducido:', tipo);
        
    } catch (error) {
        console.error('❌ Error reproduciendo sonido:', error);
    }
};

/**
 * Sonido Beep simple
 */
function reproducirBeep(audioCtx) {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    
    oscillator.start(audioCtx.currentTime);
    oscillator.stop(audioCtx.currentTime + 0.3);
}

/**
 * Sonido Chime suave y profesional (RECOMENDADO)
 */
function reproducirChime(audioCtx) {
    const frecuencias = [523.25, 659.25, 783.99]; // Do5, Mi5, Sol5
    const tiempoInicio = audioCtx.currentTime;
    
    frecuencias.forEach((freq, index) => {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.frequency.value = freq;
        oscillator.type = 'sine';
        
        const inicio = tiempoInicio + (index * 0.08);
        gainNode.gain.setValueAtTime(0, inicio);
        gainNode.gain.linearRampToValueAtTime(0.15, inicio + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, inicio + 0.4);
        
        oscillator.start(inicio);
        oscillator.stop(inicio + 0.4);
    });
}

/**
 * Sonido Alert urgente (doble beep)
 */
function reproducirAlert(audioCtx) {
    const tiempos = [0, 0.15];
    
    tiempos.forEach(tiempo => {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.frequency.value = 880;
        oscillator.type = 'square';
        
        const inicio = audioCtx.currentTime + tiempo;
        gainNode.gain.setValueAtTime(0.2, inicio);
        gainNode.gain.exponentialRampToValueAtTime(0.01, inicio + 0.1);
        
        oscillator.start(inicio);
        oscillator.stop(inicio + 0.1);
    });
}

/**
 * Sonido Bell (campana)
 */
function reproducirBell(audioCtx) {
    const frecuencias = [800, 1000, 1200];
    const tiempoInicio = audioCtx.currentTime;
    
    frecuencias.forEach((freq, index) => {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.frequency.value = freq;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.1, tiempoInicio);
        gainNode.gain.exponentialRampToValueAtTime(0.01, tiempoInicio + 1.0);
        
        oscillator.start(tiempoInicio);
        oscillator.stop(tiempoInicio + 1.0);
    });
}

/**
 * Sonido Success (melodía ascendente)
 */
function reproducirSuccess(audioCtx) {
    const frecuencias = [523.25, 659.25, 783.99, 1046.50]; // Do5, Mi5, Sol5, Do6
    const tiempoInicio = audioCtx.currentTime;
    
    frecuencias.forEach((freq, index) => {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.frequency.value = freq;
        oscillator.type = 'sine';
        
        const inicio = tiempoInicio + (index * 0.1);
        gainNode.gain.setValueAtTime(0, inicio);
        gainNode.gain.linearRampToValueAtTime(0.15, inicio + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, inicio + 0.3);
        
        oscillator.start(inicio);
        oscillator.stop(inicio + 0.3);
    });
}

/**
 * Activar/Desactivar audio
 */
window.toggleAudio = function() {
    audioActivado = !audioActivado;
    console.log(audioActivado ? '🔊 Audio activado' : '🔇 Audio desactivado');
    return audioActivado;
};

/**
 * Cambiar tipo de sonido
 */
window.cambiarTipoSonido = function(tipo) {
    const tiposValidos = ['beep', 'chime', 'alert', 'bell', 'success'];
    if (tiposValidos.includes(tipo)) {
        tipoSonidoNotificacion = tipo;
        console.log('🎵 Tipo de sonido cambiado a:', tipo);
        return true;
    }
    console.error('❌ Tipo de sonido no válido:', tipo);
    return false;
};

/**
 * Función de prueba
 */
window.testearSonidoNotificacion = function() {
    console.log('🔊 Probando sonido...');
    window.reproducirSonidoNotificacion();
    
    if (typeof showNotification === 'function') {
        showNotification('¡Sonido de prueba reproducido!', 'success');
    }
};

console.log('✅ Sistema de notificaciones con sonido cargado');
console.log('🎵 Tipo de sonido actual:', tipoSonidoNotificacion);
console.log('🔊 Audio:', audioActivado ? 'Activado' : 'Desactivado');
console.log('💡 Funciones disponibles:');
console.log('   - window.reproducirSonidoNotificacion()');
console.log('   - window.testearSonidoNotificacion()');
console.log('   - window.toggleAudio()');
console.log('   - window.cambiarTipoSonido("chime|beep|alert|bell|success")');