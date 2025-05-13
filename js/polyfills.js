/**
 * Polyfills for iOS 9 Safari compatibility
 */

// Array.prototype.forEach polyfill 
if (!Array.prototype.forEach) {
    Array.prototype.forEach = function(callback, thisArg) {
        var T, k;
        if (this == null) {
            throw new TypeError('this is null or not defined');
        }
        var O = Object(this);
        var len = O.length >>> 0;
        if (typeof callback !== 'function') {
            throw new TypeError(callback + ' is not a function');
        }
        if (arguments.length > 1) {
            T = thisArg;
        }
        k = 0;
        while (k < len) {
            var kValue;
            if (k in O) {
                kValue = O[k];
                callback.call(T, kValue, k, O);
            }
            k++;
        }
    };
}

// Element.prototype.classList polyfill (simplified)
if (!("classList" in document.documentElement)) {
    Object.defineProperty(Element.prototype, 'classList', {
        get: function() {
            var self = this;
            function update(fn) {
                return function(value) {
                    var classes = self.className.split(/\s+/g);
                    var index = classes.indexOf(value);
                    fn(classes, index, value);
                    self.className = classes.join(" ");
                    return self;
                };
            }

            return {
                add: update(function(classes, index, value) {
                    if (index === -1) {
                        classes.push(value);
                    }
                }),
                remove: update(function(classes, index) {
                    if (index !== -1) {
                        classes.splice(index, 1);
                    }
                }),
                toggle: update(function(classes, index, value) {
                    if (index === -1) {
                        classes.push(value);
                    } else {
                        classes.splice(index, 1);
                    }
                }),
                contains: function(value) {
                    return self.className.split(/\s+/g).indexOf(value) !== -1;
                }
            };
        }
    });
}

// Promise polyfill (minimal)
if (!window.Promise) {
    window.Promise = function(executor) {
        var self = this;
        self.status = 'pending';
        self.value = null;
        self.reason = null;
        self.onResolvedCallbacks = [];
        self.onRejectedCallbacks = [];

        function resolve(value) {
            if (self.status === 'pending') {
                self.status = 'resolved';
                self.value = value;
                for (var i = 0; i < self.onResolvedCallbacks.length; i++) {
                    self.onResolvedCallbacks[i](value);
                }
            }
        }

        function reject(reason) {
            if (self.status === 'pending') {
                self.status = 'rejected';
                self.reason = reason;
                for (var i = 0; i < self.onRejectedCallbacks.length; i++) {
                    self.onRejectedCallbacks[i](reason);
                }
            }
        }

        try {
            executor(resolve, reject);
        } catch (e) {
            reject(e);
        }
    };

    window.Promise.prototype.then = function(onResolved, onRejected) {
        var self = this;
        if (self.status === 'resolved') {
            setTimeout(function() {
                onResolved(self.value);
            });
        } else if (self.status === 'rejected') {
            setTimeout(function() {
                onRejected(self.reason);
            });
        } else if (self.status === 'pending') {
            self.onResolvedCallbacks.push(onResolved);
            self.onRejectedCallbacks.push(onRejected);
        }
        return self;
    };

    window.Promise.prototype.catch = function(onRejected) {
        return this.then(null, onRejected);
    };
}

// Object.assign polyfill
if (typeof Object.assign != 'function') {
    Object.assign = function(target) {
        if (target == null) {
            throw new TypeError('Cannot convert undefined or null to object');
        }

        target = Object(target);
        for (var index = 1; index < arguments.length; index++) {
            var source = arguments[index];
            if (source != null) {
                for (var key in source) {
                    if (Object.prototype.hasOwnProperty.call(source, key)) {
                        target[key] = source[key];
                    }
                }
            }
        }
        return target;
    };
}

// Add passive event listener support if needed
try {
    var opts = Object.defineProperty({}, 'passive', {
        get: function() {
            window.supportsPassive = true;
        }
    });
    window.addEventListener("test", null, opts);
} catch (e) {
    window.supportsPassive = false;
} 