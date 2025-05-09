/**
 * Polyfills for older browsers (iOS 9 Safari)
 */

// Promise polyfill
if (typeof Promise === 'undefined') {
    (function() {
        function Promise(executor) {
            var self = this;
            self.status = 'pending';
            self.value = undefined;
            self.reason = undefined;
            self.onResolvedCallbacks = [];
            self.onRejectedCallbacks = [];
            
            function resolve(value) {
                if (self.status === 'pending') {
                    self.status = 'fulfilled';
                    self.value = value;
                    self.onResolvedCallbacks.forEach(function(fn) { fn(value); });
                }
            }
            
            function reject(reason) {
                if (self.status === 'pending') {
                    self.status = 'rejected';
                    self.reason = reason;
                    self.onRejectedCallbacks.forEach(function(fn) { fn(reason); });
                }
            }
            
            try {
                executor(resolve, reject);
            } catch (e) {
                reject(e);
            }
        }
        
        Promise.prototype.then = function(onFulfilled, onRejected) {
            var self = this;
            var promise2 = new Promise(function(resolve, reject) {
                if (self.status === 'fulfilled') {
                    setTimeout(function() {
                        try {
                            if (typeof onFulfilled !== 'function') {
                                resolve(self.value);
                            } else {
                                var x = onFulfilled(self.value);
                                resolve(x);
                            }
                        } catch (e) {
                            reject(e);
                        }
                    }, 0);
                }
                
                if (self.status === 'rejected') {
                    setTimeout(function() {
                        try {
                            if (typeof onRejected !== 'function') {
                                reject(self.reason);
                            } else {
                                var x = onRejected(self.reason);
                                resolve(x);
                            }
                        } catch (e) {
                            reject(e);
                        }
                    }, 0);
                }
                
                if (self.status === 'pending') {
                    self.onResolvedCallbacks.push(function(value) {
                        setTimeout(function() {
                            try {
                                if (typeof onFulfilled !== 'function') {
                                    resolve(value);
                                } else {
                                    var x = onFulfilled(value);
                                    resolve(x);
                                }
                            } catch (e) {
                                reject(e);
                            }
                        }, 0);
                    });
                    
                    self.onRejectedCallbacks.push(function(reason) {
                        setTimeout(function() {
                            try {
                                if (typeof onRejected !== 'function') {
                                    reject(reason);
                                } else {
                                    var x = onRejected(reason);
                                    resolve(x);
                                }
                            } catch (e) {
                                reject(e);
                            }
                        }, 0);
                    });
                }
            });
            
            return promise2;
        };
        
        Promise.prototype.catch = function(onRejected) {
            return this.then(null, onRejected);
        };
        
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
        
        Promise.all = function(promises) {
            return new Promise(function(resolve, reject) {
                if (!Array.isArray(promises)) {
                    return reject(new TypeError('Promise.all accepts an array'));
                }
                
                var results = [];
                var remaining = promises.length;
                
                if (remaining === 0) {
                    return resolve(results);
                }
                
                function resolver(index) {
                    return function(value) {
                        results[index] = value;
                        if (--remaining === 0) {
                            resolve(results);
                        }
                    };
                }
                
                for (var i = 0; i < promises.length; i++) {
                    Promise.resolve(promises[i]).then(resolver(i), reject);
                }
            });
        };
        
        window.Promise = Promise;
    })();
}

// ClassList polyfill (simplified)
if (!('classList' in document.documentElement)) {
    Object.defineProperty(Element.prototype, 'classList', {
        get: function() {
            var self = this;
            
            function update(fn) {
                return function(value) {
                    var classes = self.className.split(/\s+/);
                    var index = classes.indexOf(value);
                    fn(classes, index, value);
                    self.className = classes.join(' ');
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
                    return self.className.split(/\s+/).indexOf(value) !== -1;
                }
            };
        }
    });
}

// Array.from polyfill
if (!Array.from) {
    Array.from = function(arrayLike) {
        return [].slice.call(arrayLike);
    };
}

// Object.assign polyfill
if (typeof Object.assign != 'function') {
    Object.assign = function(target) {
        if (target == null) {
            throw new TypeError('Cannot convert undefined or null to object');
        }
        
        var to = Object(target);
        
        for (var i = 1; i < arguments.length; i++) {
            var nextSource = arguments[i];
            
            if (nextSource != null) {
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

// CustomEvent polyfill
if (typeof window.CustomEvent !== 'function') {
    window.CustomEvent = function(event, params) {
        params = params || { bubbles: false, cancelable: false, detail: null };
        var evt = document.createEvent('CustomEvent');
        evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
        return evt;
    };
} 