/**
 * pinch-zoom.js — масштабирование жестом щипка для контейнеров списков на сенсорных устройствах
 */

function getDistance(touch1, touch2) {
  return Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
}

function getCenter(touch1, touch2) {
  return {
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2
  };
}

/**
 * Включает масштабирование щипком для контейнера.
 * @param {HTMLElement} container — контейнер (область прокрутки списка)
 * @param {{ innerSelector?: string, minScale?: number, maxScale?: number }} options
 *   innerSelector — селектор элемента, к которому применяется scale (по умолчанию первый дочерний или container)
 *   minScale, maxScale — пределы масштаба (по умолчанию 0.7 и 1.5)
 * @returns {function()} destroy — отключить обработчики
 */
export function initPinchZoom(container, options) {
  if (!container) return function () {};
  var opts = options || {};
  var minScale = opts.minScale != null ? opts.minScale : 0.7;
  var maxScale = opts.maxScale != null ? opts.maxScale : 1.5;
  var inner = opts.innerSelector
    ? container.querySelector(opts.innerSelector)
    : container.firstElementChild || container;
  if (!inner) return function () {};

  var currentScale = 1;
  var initialDistance = 0;
  var initialScale = 1;
  var touching = false;

  function setScale(value) {
    currentScale = Math.min(maxScale, Math.max(minScale, value));
    inner.style.transform = 'scale(' + currentScale + ')';
    inner.style.transformOrigin = 'center center';
  }

  function onTouchStart(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      touching = true;
      initialDistance = getDistance(e.touches[0], e.touches[1]);
      initialScale = currentScale;
    }
  }

  function onTouchMove(e) {
    if (e.touches.length === 2 && touching) {
      e.preventDefault();
      var dist = getDistance(e.touches[0], e.touches[1]);
      if (initialDistance > 0) {
        var scale = (dist / initialDistance) * initialScale;
        setScale(scale);
      }
    }
  }

  function onTouchEnd(e) {
    if (e.touches.length < 2) {
      touching = false;
      initialDistance = 0;
      initialScale = currentScale;
    }
  }

  container.addEventListener('touchstart', onTouchStart, { passive: false });
  container.addEventListener('touchmove', onTouchMove, { passive: false });
  container.addEventListener('touchend', onTouchEnd, { passive: true });
  container.addEventListener('touchcancel', onTouchEnd, { passive: true });

  return function destroy() {
    container.removeEventListener('touchstart', onTouchStart);
    container.removeEventListener('touchmove', onTouchMove);
    container.removeEventListener('touchend', onTouchEnd);
    container.removeEventListener('touchcancel', onTouchEnd);
    inner.style.transform = '';
    inner.style.transformOrigin = '';
  };
}
