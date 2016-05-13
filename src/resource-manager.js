'use strict';
import Promise from 'promise';
import _ from 'lodash';
/**
 * Makes sure that a path is converted to an array.
 * @param paths
 * @returns {*}
 */
let ensurePathArray = function (paths) {
    if (!paths) {
        paths = [];
    } else if (typeof paths === 'string') {
        paths = [paths];
    }
    return paths;
};

/**
 The Resource Manager.
 @class ResourceManager
 @description Represents a manager that loads any CSS and Javascript Resources on the fly.
 */
class ResourceManager {

    /**
     * Upon initialization.
     * @memberOf ResourceManager
     */
    constructor () {
        this._head = document.getElementsByTagName('head')[0];
        this._cssPaths = {};
        this._scriptMaps = {};
        this._dataPromises = {};
    }

    /**
     * Loads a javascript file.
     * @param {string|Array} paths - The path to the view's js file
     * @memberOf ResourceManager
     * @return {Promise} Returns a promise that resolves when all scripts have been loaded
     */
    loadScript (paths) {
        var script,
            map,
            loadPromises = [];
        paths = ensurePathArray(paths);
        paths.forEach(function (path) {
            map = this._scriptMaps[path] = this._scriptMaps[path] || {};
            if (!map.promise) {
                map.path = path;
                map.promise = new Promise(function (resolve) {
                    script = this.createScriptElement();
                    script.setAttribute('type','text/javascript');
                    script.src = path;
                    script.addEventListener('load', resolve);
                    this._head.appendChild(script);
                }.bind(this));
            }
            loadPromises.push(map.promise);
        }.bind(this));
        return Promise.all(loadPromises);
    }

    /**
     * Removes a script that has the specified path from the head of the document.
     * @param {string|Array} paths - The paths of the scripts to unload
     * @memberOf ResourceManager
     */
    unloadScript (paths) {
        var file;
        return new Promise(function (resolve) {
            paths = ensurePathArray(paths);
            paths.forEach(function (path) {
                file = this._head.querySelectorAll('script[src="' + path + '"]')[0];
                if (file) {
                    this._head.removeChild(file);
                    delete this._scriptMaps[path];
                }
            }.bind(this));
            resolve();
        }.bind(this));
    }

    /**
     * Creates a new script element.
     * @returns {HTMLElement}
     */
    createScriptElement () {
        return document.createElement('script');
    }

    /**
     * Makes a request to get data and caches it.
     * @param {string} url - The url to fetch data from
     * @param [reqOptions] - options to be passed to fetch call
     * @returns {*}
     */
    fetchData (url, reqOptions = {}) {
        var cacheId = url + JSON.stringify(reqOptions);

        reqOptions.cache = reqOptions.cache === undefined ? true : reqOptions.cache;

        if (!url) {
            return Promise.resolve();
        }
        if (!this._dataPromises[cacheId] || !reqOptions.cache) {
            this._dataPromises[cacheId] = fetch(url, reqOptions)
                .catch((e) => {
                    // if failure, remove cache so that subsequent
                    // requests will trigger new ajax call
                    this._dataPromises[cacheId] = null;
                    throw e;
                });
        }
        return this._dataPromises[cacheId];
    }

    /**
     * Loads css files.
     * @param {Array|String} paths - An array of css paths files to load
     * @memberOf ResourceManager
     * @return {Promise}
     */
    loadCss (paths) {
        return new Promise(function (resolve) {
            paths = ensurePathArray(paths);
            paths.forEach(function (path) {
                // TODO: figure out a way to find out when css is guaranteed to be loaded,
                // and make this return a truely asynchronous promise
                if (!this._cssPaths[path]) {
                    var el = document.createElement('link');
                    el.setAttribute('rel','stylesheet');
                    el.setAttribute('href', path);
                    this._head.appendChild(el);
                    this._cssPaths[path] = el;
                }
            }.bind(this));
            resolve();
        }.bind(this));
    }

    /**
     * Unloads css paths.
     * @param {string|Array} paths - The css paths to unload
     * @memberOf ResourceManager
     * @return {Promise}
     */
    unloadCss (paths) {
        var el;
        return new Promise(function (resolve) {
            paths = ensurePathArray(paths);
            paths.forEach(function (path) {
                el = this._cssPaths[path];
                if (el) {
                    this._head.removeChild(el);
                    this._cssPaths[path] = null;
                }
            }.bind(this));
            resolve();
        }.bind(this));
    }

    /**
     * Parses a template into a DOM element, then returns element back to you.
     * @param {string} path - The path to the template
     * @param {HTMLElement} [el] - The element to attach template to
     * @returns {Promise} Returns a promise that resolves with contents of template file
     */
    loadTemplate (path, el) {
        if (path) {
            return fetch(path).then(function (resp) {
                return resp.text().then(function (contents) {
                    if (el) {
                        el.innerHTML = contents;
                        contents = el;
                    }
                    return contents;
                })
            });
        } else {
            // no path was supplied
            return Promise.resolve();
        }
    }

    /**
     * Removes all cached resources.
     * @memberOf ResourceManager
     */
    flush () {
        this.unloadCss(Object.getOwnPropertyNames(this._cssPaths));
        this._cssPaths = {};
        _.each(this._scriptMaps, function (map) {
            this.unloadScript(map.path);
        }.bind(this));
        this._scriptMaps = {};
        this._dataPromises = {};
    }

}

module.exports = new ResourceManager();
