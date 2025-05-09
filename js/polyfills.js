/**
 * Polyfills for RustyPages
 * Ensures compatibility with older browsers like iOS 9 Safari
 */

/**
 * Safari iOS 9 specific fixes and polyfills
 */

// Handle broken localStorage in private browsing mode
try {
    localStorage.setItem('test', 'test');
    localStorage.removeItem('test');
} catch (e) {
    // Create a memory-based fallback for localStorage
    var MemoryStorage = function() {
        this.data = {};
        this.setItem = function(key, value) {
            this.data[key] = String(value);
        };
        this.getItem = function(key) {
            return this.data[key] === undefined ? null : this.data[key];
        };
        this.removeItem = function(key) {
            delete this.data[key];
        };
        this.clear = function() {
            this.data = {};
        };
    };
    
    // Replace localStorage with our implementation
    Object.defineProperty(window, 'localStorage', {
        value: new MemoryStorage(),
        writable: false,
        configurable: false
    });
    
    console.log('Using memory storage fallback for localStorage');
}

// Fix requestAnimationFrame for iOS Safari
(function() {
    var lastTime = 0;
    var vendors = ['webkit', 'moz', 'ms', 'o'];
    for (var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x] + 'RequestAnimationFrame'];
        window.cancelAnimationFrame = window[vendors[x] + 'CancelAnimationFrame'] || 
                                     window[vendors[x] + 'CancelRequestAnimationFrame'];
    }

    if (!window.requestAnimationFrame) {
        window.requestAnimationFrame = function(callback) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() {
                callback(currTime + timeToCall);
            }, timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };
    }

    if (!window.cancelAnimationFrame) {
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
    }
}());

// Fix for missing event.path in iOS Safari
if (!Event.prototype.hasOwnProperty('path')) {
    Object.defineProperty(Event.prototype, 'path', {
        get: function() {
            var path = [];
            var currentElem = this.target;
            while (currentElem) {
                path.push(currentElem);
                currentElem = currentElem.parentElement;
            }
            if (path.indexOf(window) === -1 && path.indexOf(document) === -1) {
                path.push(document);
            }
            if (path.indexOf(window) === -1) {
                path.push(window);
            }
            return path;
        }
    });
}

// Fix for missing Element.matches
if (!Element.prototype.matches) {
    Element.prototype.matches = 
        Element.prototype.matchesSelector || 
        Element.prototype.mozMatchesSelector ||
        Element.prototype.msMatchesSelector || 
        Element.prototype.oMatchesSelector || 
        Element.prototype.webkitMatchesSelector ||
        function(s) {
            var matches = (this.document || this.ownerDocument).querySelectorAll(s),
                i = matches.length;
            while (--i >= 0 && matches.item(i) !== this) {}
            return i > -1;            
        };
}

// Array.from polyfill
if (!Array.from) {
    Array.from = function (iterable) {
        if (iterable === null || iterable === undefined) {
            throw new TypeError('Cannot convert undefined or null to object');
        }
        
        var arrayLike = Object(iterable);
        var len = arrayLike.length >>> 0;
        var result = new Array(len);
        
        for (var i = 0; i < len; i++) {
            if (i in arrayLike) {
                result[i] = arrayLike[i];
            }
        }
        
        return result;
    };
}

// Promise polyfill for iOS 9
if (typeof Promise === 'undefined') {
    // Simple Promise polyfill (basic implementation)
    window.Promise = function(executor) {
        var callbacks = [];
        var state = 'pending';
        var value;
        
        function resolve(newValue) {
            if (state !== 'pending') return;
            value = newValue;
            state = 'fulfilled';
            execute();
        }
        
        function reject(reason) {
            if (state !== 'pending') return;
            value = reason;
            state = 'rejected';
            execute();
        }
        
        function execute() {
            setTimeout(function() {
                callbacks.forEach(function(callback) {
                    var cb = state === 'fulfilled' ? callback.onFulfilled : callback.onRejected;
                    if (typeof cb === 'function') {
                        try {
                            var result = cb(value);
                            callback.resolve(result);
                        } catch(e) {
                            callback.reject(e);
                        }
                    } else {
                        (state === 'fulfilled' ? callback.resolve : callback.reject)(value);
                    }
                });
                callbacks = [];
            }, 0);
        }
        
        this.then = function(onFulfilled, onRejected) {
            return new Promise(function(resolve, reject) {
                callbacks.push({
                    onFulfilled: onFulfilled,
                    onRejected: onRejected,
                    resolve: resolve,
                    reject: reject
                });
                if (state !== 'pending') {
                    execute();
                }
            });
        };
        
        this.catch = function(onRejected) {
            return this.then(null, onRejected);
        };
        
        try {
            executor(resolve, reject);
        } catch(e) {
            reject(e);
        }
    };
    
    // Static methods
    Promise.resolve = function(value) {
        return new Promise(function(resolve) {
            resolve(value);
        });
    };
    
    Promise.reject = function(reason) {
        return new Promise(function(resolve, reject) {
            reject(reason);
        });
    };
}

// Object.assign polyfill
if (typeof Object.assign !== 'function') {
    Object.assign = function(target) {
        'use strict';
        if (target === null || target === undefined) {
            throw new TypeError('Cannot convert undefined or null to object');
        }

        var to = Object(target);
        
        for (var index = 1; index < arguments.length; index++) {
            var nextSource = arguments[index];
            
            if (nextSource !== null && nextSource !== undefined) {
                for (var nextKey in nextSource) {
                    if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
                        to[nextKey] = nextSource[nextKey];
                    }
                }
            }
        }
        
        return to;
    };
}

// ClassList toggle with second parameter polyfill
if (window.DOMTokenList && !window.DOMTokenList.prototype.toggle.length) {
    var original = window.DOMTokenList.prototype.toggle;
    window.DOMTokenList.prototype.toggle = function(token, force) {
        if (1 in arguments && !this.contains(token) === !force) {
            return force;
        } else {
            return original.call(this, token);
        }
    };
}

// Older iOS fixes
(function() {
    // Fix for 'tap delay' on older iOS Safari
    document.addEventListener('touchend', function() {}, false);
    
    // Fix CSS position:fixed on iOS
    var iOS = !!navigator.platform && /iPad|iPhone|iPod/.test(navigator.platform);
    if (iOS) {
        document.documentElement.classList.add('ios-device');
    }
})();

// Fix for Object.keys being undefined on older Safari
if (!Object.keys) {
    Object.keys = function(obj) {
        var keys = [];
        for (var key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                keys.push(key);
            }
        }
        return keys;
    };
}

// ES5 fix for Function.prototype.bind
if (!Function.prototype.bind) {
    Function.prototype.bind = function(oThis) {
        if (typeof this !== 'function') {
            throw new TypeError('Function.prototype.bind - what is trying to be bound is not callable');
        }
        
        var aArgs = Array.prototype.slice.call(arguments, 1);
        var fToBind = this;
        var fNOP = function() {};
        var fBound = function() {
            return fToBind.apply(
                this instanceof fNOP ? this : oThis,
                aArgs.concat(Array.prototype.slice.call(arguments))
            );
        };
        
        if (this.prototype) {
            fNOP.prototype = this.prototype;
        }
        
        fBound.prototype = new fNOP();
        return fBound;
    };
}

// iOS font bugfix - sometimes fonts don't load correctly in iOS PWAs
window.addEventListener('DOMContentLoaded', function() {
    // Force font redraw by making a small change to the body and then reverting it
    setTimeout(function() {
        document.body.style.opacity = "0.99";
        setTimeout(function() {
            document.body.style.opacity = "1";
        }, 50);
    }, 500);
}); 