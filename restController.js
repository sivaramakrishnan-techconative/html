
/*global WM, wm, _*/
wm.plugins.webServices.controllers.RestServiceController = [
    '$scope',
    '$rootScope',
    'WebService',
    'Utils',
    'WS_CONSTANTS',
    '$base64',
    'wmToaster',
    '$timeout',
    'SWAGGER_CONSTANTS',
    'DB_CONSTANTS',
    'oAuthProviderService',
    'DialogService',
    'VARIABLE_CONSTANTS',

    function ($s, $rs, WebService, Utils, WS_CONSTANTS, $base64, wmToaster, $timeout, SWAGGER_CONSTANTS, DB_CONSTANTS, oAuthProviderService, DialogService, VARIABLE_CONSTANTS) {
        'use strict';

        var sampleResponse,
            cachedParams,
            restRequestFormat,
            AUTH_TYPE_BASIC = VARIABLE_CONSTANTS.REST_SERVICE.AUTH_TYPE_BASIC,
            AUTH_TYPE_NONE = VARIABLE_CONSTANTS.REST_SERVICE.AUTH_TYPE_NONE,
            AUTH_TYPE_OAUTH = VARIABLE_CONSTANTS.REST_SERVICE.AUTH_TYPE_OAUTH,
            BASE_PATH_KEY = VARIABLE_CONSTANTS.REST_SERVICE.BASE_PATH_KEY,
            RELATIVE_PATH_KEY = VARIABLE_CONSTANTS.REST_SERVICE.RELATIVE_PATH_KEY,
            CONTENT_TYPE_KEY = VARIABLE_CONSTANTS.REST_SERVICE.CONTENT_TYPE_KEY,
            VARIABLE_TYPE = VARIABLE_CONSTANTS.REST_SERVICE.VARIABLE_TYPE,
            VARIABLE_KEY = VARIABLE_CONSTANTS.REST_SERVICE.VARIABLE_KEY,
            SERVER = SWAGGER_CONSTANTS.SERVER,
            APP_ENVIRONMENT = SWAGGER_CONSTANTS.APP_ENVIRONMENT,
            PROMPT = SWAGGER_CONSTANTS.PROMPT,
            VARIABLE_APP_ENV = SWAGGER_CONSTANTS.VARIABLE_APP_ENV,

            SERVICE_TYPES = {
                BOOLEAN: DB_CONSTANTS.DATABASE_DATA_TYPES.boolean.java_type,
                DATE: DB_CONSTANTS.DATABASE_DATA_TYPES.date.java_type,
                DOUBLE: DB_CONSTANTS.DATABASE_DATA_TYPES.double.java_type,
                FLOAT: DB_CONSTANTS.DATABASE_DATA_TYPES.float.java_type,
                INTEGER: DB_CONSTANTS.DATABASE_DATA_TYPES.integer.java_type,
                LONG: DB_CONSTANTS.DATABASE_DATA_TYPES.long.java_type,
                STRING: DB_CONSTANTS.DATABASE_DATA_TYPES.string.java_type,
                DATE_TIME: "date-time",
                NUMBER: "number"
            },
            PARAMETER_TYPE_KEY = 'in',
            TYPE_KEY = 'type',
            ITEMS_KEY = 'items',
            SCHEMA_KEY = 'schema',
            authString,
            RUNTIME_CALL_MODE = {
                PROXY: 'PROXY',
                DIRECT: 'DIRECT'
            },
            primitiveMultipartTypes = ['string', 'file'],
            ADD_PROVIDER = $rs.locale.LABEL_REST_SERVICE_ADD_PROVIDER,
            lastSelectedProvider,
            oAuthProviderKey,
            existingProviderKeys = [],
            listeners = [];

        $s.OTHER_CUSTOM_TYPE = 'Other...';

        $s.headers = ["Accept", "Accept-Charset", "Accept-Encoding", "Accept-Language", "Authorization", "Content-Length", "Content-Type", "Cookie", "Origin", "Referer", "User-Agent"];
        $s.headerValues = ["application/json", "application/octet-stream", "application/pdf", "application/xml", "application/x-www-form-urlencoded", "multipart/form-data", "text/html", "text/plain", "text/xml"];

        $s.AUTH_TYPES = {
            'None': AUTH_TYPE_NONE,
            'Basic': AUTH_TYPE_BASIC,
            'OAuth 2.0': AUTH_TYPE_OAUTH
        };

        /**
         * opens the oauth config dialog
         * @param provider
         */
        function openOAuthConfigDialog(provider) {
            lastSelectedProvider = provider;
            DialogService.showDialog('oAuthProviderConfigDialog', {
                resolve: {
                    dialogParams: function () {
                        return {
                            'onClose': function () {
                                if ($s.ws.oAuthProviderId) {
                                    $s.showOAuthEditButton = true;
                                    $s.disableTest = false;
                                }
                            },
                            'onSave': function (providerId) {
                                $s.ws.oAuthProviderId = providerId;
                                loadoAuthProviders(providerId);
                                DialogService.hideDialog('oAuthSelectionDialog');
                                $s.showOAuthEditButton = true;
                            },
                            'provider': provider,
                            'existingProviderKeys': existingProviderKeys
                        };
                    }
                }
            });
        }
        /**
         * function to open the oauthConfig dialog when add provider is selected
         */
        function onProviderChange(providerId) {
            if (providerId === null && $s.ws.editMode) { //providerId is null when the dom is initialized
                $s.ws.oAuthProviderId = oAuthProviderKey;
                return;
            }
            assignActiveOAuthProvider(providerId);
            if (providerId === ADD_PROVIDER) {
                $s.showOAuthEditButton = false;
                openOAuthConfigDialog();
            } else {
                getAuthorizationUrl(providerId);
            }
        }

        /**
         *this function opens the oauth selection dialog
         */
        function openOAuthSelectionDialog() {
            DialogService.showDialog('oAuthSelectionDialog', {
                resolve: {
                    dialogParams: function () {
                        return {
                            'onClose': function () {
                                $s.ws.oAuthProvider = {};
                                $s.ws.oAuthProviderId = '';
                            },
                            'onSelection': function (providerId) {
                                onProviderChange(providerId);
                            },
                            'providers': $s.OAUTH_PROVIDERS
                        };
                    }
                }
            });
        }

        /**
         * function to load the configured providers to display them in the Provider List
         */
        function loadoAuthProviders(providerId) {
            $s.OAUTH_PROVIDERS = [];
            existingProviderKeys = [];
            $s.toggleSpinner(true);
            oAuthProviderService.loadConfiguredProviders().then(function (configuredProviders) {
                $s.OAUTH_PROVIDERS = configuredProviders.map(function (provider) {
                    provider.isConfigured = true;
                    existingProviderKeys.push(provider.providerId);
                    return provider;
                }) || [];
                oAuthProviderService.loadDefaultProviders().then(function (defaultProviders) {
                    _.forEach(defaultProviders, function (provider) {
                        var configuredProvider = _.find(configuredProviders, { providerId: provider.providerId });
                        if (!configuredProvider) {
                            provider.isDefault = true;
                            $s.OAUTH_PROVIDERS.push(provider);
                            existingProviderKeys.push(provider.providerId);
                        } else {
                            configuredProvider.isDefault = true;
                        }
                    });
                    if ($s.ws.editMode) {
                        $s.ws.oAuthProviderId = oAuthProviderKey;
                    }
                    if ($s.ws.oAuthProviderId === ADD_PROVIDER) { //reset the model if add provider was initially selected
                        $s.ws.oAuthProviderId = '';
                    } else {
                        $s.ws.oAuthProviderId = $s.ws.oAuthProviderId || (lastSelectedProvider && lastSelectedProvider.providerId);
                        assignActiveOAuthProvider(providerId);
                        getAuthorizationUrl();
                    }
                });
                $s.toggleSpinner(false);
            }, function () {
                $s.toggleSpinner(false);
            });
        }

        function setTypeBasedOnFormat(param) {
            if (_.includes([SERVICE_TYPES.DATE_TIME, SERVICE_TYPES.DATE, SERVICE_TYPES.STRING, SERVICE_TYPES.BOOLEAN], param.format)) {
                param.type = SERVICE_TYPES.STRING;
            } else if (param.format === 'int64') {
                param.type = SERVICE_TYPES.LONG;
            } else if (param.format === 'int32') {
                param.type = SERVICE_TYPES.INTEGER;
            } else if (_.includes([SERVICE_TYPES.FLOAT, SERVICE_TYPES.DOUBLE], param.format)) {
                param.type = SERVICE_TYPES.NUMBER;
            }
        }

        /**
         * Sets the editor type to specified type
         * @param type
         */
        function setEditorType(type) {
            $s.ws.editorType = type || 'text';
        }

        function transformQueryParam(inputParams) {
            _.forEach(inputParams, function (param) {
                if (param[PARAMETER_TYPE_KEY] === $s.ws.paramType.QUERY.toLowerCase()) {
                    setTypeBasedOnFormat(param);
                }
            });
            return inputParams;
        }

        //function to get the authorization url
        function getAuthorizationUrl(providerId) {
            if (_.isEmpty($s.ws.oAuthProviderId) && _.isEmpty(providerId)) {
                return;
            }
            if (!$s.ws.oAuthProvider.isConfigured) {
                openOAuthConfigDialog($s.ws.oAuthProvider);
                $s.disableTest = true;
                return;
            }
            $s.ws.oAuthProviderId = providerId || $s.ws.oAuthProviderId;
            $s.showOAuthEditButton = true;
            DialogService.hideDialog('oAuthSelectionDialog');
            oAuthProviderService.getAuthorizationUrl({ 'providerId': providerId || $s.ws.oAuthProviderId }).then(function (response) {
                $s.disableTest = !response;
                $s.authorizationUrl = response;
            });
        }

        function onHttpMethodChange() {
            $s.ws.contentType = $s.ws.contentTypeList[0];
            $s.ws.onContentTypeChange();
            $s.ws.isNonBodyMethodSelected = _.includes($s.ws.nonBodyMethods, $s.ws.serviceMethod);
            $s.ws.serviceTested = false;
            $s.ws.activeTabIndex = 0;
        }

        // toggling the params based on the auth selection
        function toggleAuthParams() {
            $s.ws.basicAuthRequired = false;
            $s.ws.oAuthRequired = false;
            $s.disableTest = false;
            $s.ws.serviceTested = false;
            if ($s.ws.restInfoHeaders) {
                delete $s.ws.restInfoHeaders.Authorization;
            }
            switch ($s.ws.authenticationType) {
                case AUTH_TYPE_BASIC:
                    $s.ws.basicAuthRequired = true;
                    break;
                case AUTH_TYPE_OAUTH:
                    $s.ws.oAuthRequired = true;
                    $s.disableTest = !$s.ws.oAuthProviderId;
                    break;
            }
        }
        /**
         * Switch parameter group tabs
         * assign the param group's index to teh variable activeParamGroupIdx, uib-tabset will handle switching to active tab
         * @param type
         */
        function switchTab(type, isWebSocketService) {
            if (isWebSocketService) {
                $s.ws.activeParamGroupIdx = _.findIndex($s.ws.webSocketServiceTabs, { id: type.toLowerCase() });
            } else {
                $s.ws.activeTabIndex = _.findIndex($s.ws.webServiceTabs, { id: type.toLowerCase() });
            }
        }
        /*
        * Set files to the model
        * */
        $s.ws.onFileChange = function ($node, tgtObject) {
            var files = _.map($node.files, function (file) {
                return file;
            });
            if ($s.ws.editMode) {
                $s.ws.restInfoMultipart[tgtObject.name] = files;
            }
            tgtObject.value = files;
        };
        /**
         * If the Content type is updated in Header Params tab then they should be updated in the Body Params as well
         */
        $s.ws.onParamChange = function () {
            _.forEach($s.ws.restInfoHeaders, function (headerValue, headerParam) {
                if (headerParam.toLowerCase() === 'content-type') {
                    var headerContentType = headerValue;
                    if (_.includes($s.ws.contentTypeList, headerContentType)) {
                        $s.ws.contentType = headerContentType;
                    } else {
                        $s.ws.contentTypeList.push(headerContentType);
                        $s.ws.contentType = headerContentType;
                    }
                }
            });
            //enable save button when there is any change in the param value
            $s.ws.serviceTested = true;
        };
        /**
         * If the Content type is updated in Body Params tab then they should be updated in the Header Params as well
         */
        $s.ws.onContentTypeChange = function () {
            _.forEach($s.ws.restInfoHeaders, function (headerValue, headerParam) {
                if (headerParam.toLowerCase() === 'content-type') {
                    $s.ws.restInfoHeaders[headerParam] = $s.ws.contentType;
                }
            });
        };

        /*
        * Set properties for new param based on contentType selected
        * */
        $s.ws.setParamProps = function (param) {
            var propObj = $s.ws.multipartParamTypes[param[CONTENT_TYPE_KEY]];
            param.type = propObj.type;
            param.list = propObj.list;
        };
        /*
         * checks if the provided param is complete and if param exists in current list
         * @param newParam param to be checked for existence
         */
        function isInvalidParam(newParam) {
            if (!newParam.name || !(newParam[TYPE_KEY] || newParam[SCHEMA_KEY[ITEMS_KEY[TYPE_KEY]]]) || _.find($s.ws.inputParams, { 'name': newParam.name })) {
                return true;
            }
        }

        // function to remove a param from the inputParams array and enables useProxy if no param is configured as server side property.
        function removeParam(param) {
            var i, n;
            for (i = 0, n = $s.ws.inputParams.length; i < n; i += 1) {
                if ($s.ws.inputParams[i].name === param.name && $s.ws.inputParams[i][PARAMETER_TYPE_KEY] === param[PARAMETER_TYPE_KEY]) {
                    // remove param from the list
                    $s.ws.inputParams.splice(i, 1);
                    switch (param[PARAMETER_TYPE_KEY]) {
                        case $s.ws.paramType.QUERY.toLowerCase():
                            if ($s.ws.restInfoQuery) {
                                delete $s.ws.restInfoQuery[param.name];
                            }
                            break;
                        case $s.ws.paramType.HEADER.toLowerCase():
                            if ($s.ws.restInfoHeaders) {
                                delete $s.ws.restInfoHeaders[param.name];
                                delete $s.ws.cachedHeaderParamsType[param.name];
                            }
                            break;
                        case $s.ws.paramType.FORMDATA:
                            if ($s.ws.editMode) {
                                delete $s.ws.restInfoMultipart[param.name];
                            } else {
                                _.remove($s.ws.multipartParams, { "name": param.name });
                            }
                            break;
                    }

                    /* remove param from the cached prams */
                    if (cachedParams) {
                        delete cachedParams[param.name];
                    }
                    // disables the useProxy flag if there is atleast one param (Header or Query) which is configured as a Server Side property or App Environment property
                    disableUseProxyBasedOnParamType(false);
                    //enable save button when a param is removed
                    $s.ws.serviceTested = true;
                    return;
                }
            }
        }

        /**
         * decides weather to show a param group or not
         *  - BODY params are shown if POST type method is selected
         *  - AUTH params are shown if Basic Auth is enabled
         * @param paramGroup
         * @returns {*}
         */
        function showParamGroup(paramGroup) {
            switch (paramGroup.id) {
                case $s.ws.paramType.BODY:
                    return !$s.ws.isNonBodyMethodSelected && ($s.ws.contentType !== WS_CONSTANTS.CONTENT_TYPES.MULTIPART_FORMDATA);
                case $s.ws.paramType.AUTH:
                    return $s.ws.basicAuthRequired || $s.ws.oAuthRequired;
                case $s.ws.paramType.FORMDATA:
                    return $s.ws.contentType === WS_CONSTANTS.CONTENT_TYPES.MULTIPART_FORMDATA;
                default:
                    return true;
            }
        }
        /*
        * Update param with all properties as per swagger specification
        * */
        function modifyFormDataBodyParam(newParam) {
            var $newFileInputMarkup = '<input type="file" onchange="WM.element(this).scope().ws.onFileChange(this, WM.element(this).scope().ws.newMultipartParam)" class="form-control app-fileupload new-file-input" multiple>',
                newParamType = newParam.type;
            if ($s.ws.editMode) {
                //Setting the type as per swagger specification
                if (newParam.list) {
                    var dataType = newParam.type;
                    newParam.type = 'array';
                    newParam.items = { 'type': dataType };
                    delete newParam.value;
                    delete newParam.list;
                }
                $s.ws.restInfoMultipart[newParam.name] = newParam.value;
            } else {
                $s.ws.multipartParams.push(newParam);
            }
            //Move file model from dummy tr to model
            if (newParamType === 'file') {
                $timeout(function () {
                    var $newFileInput = $('.new-file-input');
                    $newFileInput.removeClass('new-file-input');
                    $newFileInput.attr('onchange', 'WM.element(this).scope().ws.onFileChange(this, WM.element(this).scope().param)');
                    var i = $s.ws.multipartParams.length;

                    var $target = $('.multipart-table tr[ng-Repeat]:last .file-input-td');
                    $target.empty().append($newFileInput);

                    $('.new-file-input-td').empty().append($newFileInputMarkup);
                });
            }
        }

        // disables the useProxy flag if there is atleast one param (Header or Query) which is configured as a Server Side property or App Environment property
        function disableUseProxyBasedOnParamType(hasNewParam, paramType) {
            var containsServerSideProperty = false,
                containsAppEnvProperty = false;
            _.some($s.ws.inputParams, function (paramObj) {
                containsServerSideProperty = isServerSideProperty(paramObj.type);
                containsAppEnvProperty = isAppEnvironmentProperty(paramObj.type);
                // check if params contain server side property or app environment property
                if (containsServerSideProperty || containsAppEnvProperty) {
                    $s.ws.disableUseProxy = true;
                    return true;
                } else if ($s.ws.disableUseProxy) {
                    $s.ws.disableUseProxy = false;
                }
            });
            // check the param type of the new (header or query) param which is added while testing the service
            if (hasNewParam) {
                containsServerSideProperty = isServerSideProperty(paramType);
                containsAppEnvProperty = isAppEnvironmentProperty(paramType);
                // check if param contains server side property or app environment property
                if (containsServerSideProperty || containsAppEnvProperty) {
                    $s.ws.disableUseProxy = true;
                } else if ($s.ws.disableUseProxy) {
                    $s.ws.disableUseProxy = false;
                }
            }
        }

        //Add the last unpushed Header Param to the inputParams list if there exists any
        function addNewHeaderParam() {
            if ($s.ws.restInfoHeaders && !$s.ws.restInfoHeaders.hasOwnProperty($s.ws.newHeaderParam.name)) {
                if ($s.ws.newHeaderParam.format) {
                    // update the type of header param and store it's type in cachedHeaderPramsType
                    $s.ws.newHeaderParam.type = $s.ws.newHeaderParam.format;
                    $s.ws.cachedHeaderParamsType[$s.ws.newHeaderParam.name] = $s.ws.newHeaderParam.type;
                    $s.ws.headers[$s.ws.newHeaderParam.name] = $s.ws.newHeaderParam.value;
                    $s.ws.inputParams.push(Utils.getClonedObject($s.ws.newHeaderParam));
                    $s.ws.newHeaderParam.name = '';
                    $s.ws.newHeaderParam.value = '';
                    // disables the useProxy flag if there is atleast one header param which is configured as a Server Side property or App Environment property
                    disableUseProxyBasedOnParamType(true, $s.ws.newHeaderParam.type);
                    // set the new header param type to string
                    $s.ws.newHeaderParam.type = SERVICE_TYPES.STRING;
                    $s.ws.newHeaderParam.format = SERVICE_TYPES.STRING;
                    $s.ws.onParamChange();
                    return true;
                } else {
                    $s.ws.serviceTested = false;
                    $s.toggleMessage(true, Utils.replace($s.$root.locale.MESSAGE_EMPTY_PARAM_TYPE, [$s.ws.newHeaderParam.name]), 'error');
                    return false;
                }
            } else {
                $s.ws.serviceTested = false;
                $s.toggleMessage(true, Utils.replace($s.$root.locale.MESSAGE_WEBSERVICES_DUPLICATE_PARAM, [$s.ws.newHeaderParam.name]), 'error');
                return false;
            }
        }

        //Add the last unpushed Query Param to the inputParams list if there exists any
        function addNewQueryParam() {
            if ($s.ws.restInfoQuery && !$s.ws.restInfoQuery.hasOwnProperty($s.ws.newQueryParam.name)) {
                if ($s.ws.newQueryParam.format) {
                    // update the type of query param
                    $s.ws.newQueryParam.type = $s.ws.newQueryParam.format;
                    $s.ws.restInfoQuery[$s.ws.newQueryParam.name] = $s.ws.newQueryParam.value;
                    $s.ws.inputParams.push(Utils.getClonedObject($s.ws.newQueryParam));
                    setParameterizedUrl($s.ws.inputParams);
                    $s.ws.newQueryParam.name = '';
                    $s.ws.newQueryParam.value = '';
                    // disables the useProxy flag if there is atleast one query param which is configured as a Server Side property or App Environment property
                    disableUseProxyBasedOnParamType(true, $s.ws.newQueryParam.type);
                    // set the new header param type to string
                    $s.ws.newQueryParam.type = SERVICE_TYPES.STRING;
                    $s.ws.newQueryParam.format = SERVICE_TYPES.STRING;
                    $s.ws.onParamChange();
                    return true;
                } else {
                    $s.ws.serviceTested = false;
                    $s.toggleMessage(true, Utils.replace($s.$root.locale.MESSAGE_EMPTY_PARAM_TYPE, [$s.ws.newQueryParam.name]), 'error');
                    return false;
                }
            } else {
                $s.ws.serviceTested = false;
                $s.toggleMessage(true, Utils.replace($s.$root.locale.MESSAGE_WEBSERVICES_DUPLICATE_PARAM, [$s.ws.newQueryParam.name]), 'error');
                return false;
            }
        }

        // function to add a param to the input params array and disable useProxy if any param is configured as a server side property
        function addParam(type) {
            var newParam;
            $s.toggleMessage(); //remove the validation
            switch (type) {
                case $s.ws.paramType.HEADER:
                    newParam = $s.ws.newHeaderParam;
                    if (!newParam.name) {
                        $s.toggleMessage(true, $s.$root.locale.MESSAGE_WEBSERVICES_EMPTY_PARAM, 'error');
                        return;
                    }
                    if ($s.ws.restInfoHeaders && !$s.ws.restInfoHeaders.hasOwnProperty(newParam.name)) {
                        $s.ws.restInfoHeaders[newParam.name] = newParam.value;
                        $s.ws.onParamChange();
                    } else {
                        $s.toggleMessage(true, Utils.replace($s.$root.locale.MESSAGE_WEBSERVICES_DUPLICATE_PARAM, [$s.ws.newHeaderParam.name]), 'error');
                        return;
                    }
                    // showing error message if new header param type is empty
                    if (!newParam.format) {
                        $s.ws.serviceTested = false;
                        delete $s.ws.restInfoHeaders[newParam.name];
                        $s.toggleMessage(true, Utils.replace($s.$root.locale.MESSAGE_EMPTY_PARAM_TYPE, [$s.ws.newHeaderParam.name]), 'error');
                        return;
                    }
                    newParam.type = newParam.format || SERVICE_TYPES.STRING;
                    // store the type of header param in $s.ws.cachedHeaderParamsType
                    $s.ws.cachedHeaderParamsType[newParam.name] = newParam.type;
                    break;
                case $s.ws.paramType.PATH:
                    newParam = $s.ws.newPathParam;
                    break;
                case $s.ws.paramType.FORMDATA:
                    newParam = $s.ws.newMultipartParam;
                    if (isInvalidParam(newParam)) {
                        return;
                    }
                    //Update param with all properties as per swagger specification
                    modifyFormDataBodyParam(newParam);
                    break;
                default:
                    newParam = $s.ws.newQueryParam;
                    if (!newParam.name) {
                        $s.toggleMessage(true, $s.$root.locale.MESSAGE_WEBSERVICES_EMPTY_PARAM, 'error');
                        return;
                    }
                    if ($s.ws.restInfoQuery) {
                        if (!$s.ws.restInfoQuery[newParam.name]) {
                            $s.ws.restInfoQuery[newParam.name] = newParam.value;
                        } else {
                            $s.toggleMessage(true, Utils.replace($s.$root.locale.MESSAGE_WEBSERVICES_DUPLICATE_PARAM, [$s.ws.newQueryParam.name]), 'error');
                            return;
                        }
                    } else {
                        $s.ws.sampleParamValues[newParam.name] = newParam.value;
                    }
                    // showing error message if the new query param type is empty
                    if (!newParam.format) {
                        $s.ws.serviceTested = false;
                        delete $s.ws.restInfoQuery[newParam.name];
                        $s.toggleMessage(true, Utils.replace($s.$root.locale.MESSAGE_EMPTY_PARAM_TYPE, [$s.ws.newQueryParam.name]), 'error');
                        return;
                    }
                    newParam.type = newParam.format;
                    setTypeBasedOnFormat(newParam);
            }
            if (isInvalidParam(newParam)) {
                return;
            }
            $s.ws.inputParams.push(Utils.getClonedObject(newParam));
            // disables the useProxy flag if there is atleast one param (Header or Query) which is configured as a Server Side property or App Environment property
            disableUseProxyBasedOnParamType(false);
            newParam = {};
            //enable save button when a param is added
            $s.ws.serviceTested = true;
            //Reset ng-model of param types.
            $s.ws.newQueryParam.name = '';
            $s.ws.newQueryParam.type = SERVICE_TYPES.STRING;
            $s.ws.newQueryParam.format = SERVICE_TYPES.STRING;
            $s.ws.newQueryParam.value = '';
            $s.ws.newHeaderParam.name = '';
            $s.ws.newHeaderParam.type = SERVICE_TYPES.STRING;
            $s.ws.newHeaderParam.format = SERVICE_TYPES.STRING;
            $s.ws.newHeaderParam.value = '';
            $s.ws.newMultipartParam = $s.ws.getNewMultipartParam();
        }

        /*
         * caches the values provided for various params while testing the service
         * @param {none}
         */
        function cacheParamValues() {
            // query params
            cachedParams = {};

            var url = $s.ws.restURL,
                index = url.indexOf('?'),
                queryParams;

            // if query params found, extract them
            if (index !== -1) {
                queryParams = url.substring(index + 1, url.length);
                queryParams = queryParams.split('&');

                // loop over the query params and store each parameter's test value
                _.forEach(queryParams, function (param) {
                    var i = param.indexOf('='),
                        paramKey,
                        paramVal;
                    if (i !== -1) {
                        paramKey = param.substr(0, i);
                        paramVal = param.substr(i + 1, param.length);

                        // if param with same name already found, make it an array and push next value into it
                        if (cachedParams[paramKey]) {
                            cachedParams[paramKey] = WM.isArray(cachedParams[paramKey]) ? cachedParams[paramKey] : [cachedParams[paramKey]];
                            cachedParams[paramKey].push(paramVal);
                        } else {
                            cachedParams[paramKey] = paramVal;
                        }
                    }
                });
            }

            // loop over Header Params and store test values
            _.forEach($s.ws.headers, function (val, key) { cachedParams[key] = val; });

            // if post type request and sample post data provided, cache it in the body param
            if (!$s.ws.isNonBodyMethodSelected && $s.ws.requestBody) {
                cachedParams.RequestBody = $s.ws.requestBody;
            }
        }

        /**
         * caches the Header param types
         */
        function cacheHeaderParamsType() {
            $s.ws.cachedHeaderParamsType = {};
            _.forEach($s.ws.inputParams, function (paramObj) {
                if (paramObj[PARAMETER_TYPE_KEY] === $s.ws.paramType.HEADER.toLowerCase()) {
                    $s.ws.cachedHeaderParamsType[paramObj.name] = paramObj.format || paramObj.type;
                }
            })
        }
        function setParameterizedUrl(val, type) {
            var url = type === 'websocket' ? $s.ws.webSocketUrl : $s.ws.restURL;
            // if parameterized url not set previously, return
            if (!url) {
                return;
            }

            var index = _.includes(url, '?') ? url.indexOf('?') : url.length,
                plainURL = url.substring(0, index),
                i = 0,
                params = '';

            // loop over each input param to form the parameterized url out of it
            _.forEach(val, function (param) {
                if (param[PARAMETER_TYPE_KEY].toUpperCase() === $s.ws.paramType.QUERY) {
                    if (i === 0) {
                        params += '?';
                    } else {
                        params += '&';
                    }
                    params += param.name + '=' + ($s.ws.restInfoQuery[param.name] || '');
                    i += 1;
                }
            });
            if (type === 'websocket') {
                $s.ws.webSocketUrl = plainURL + params;
            } else {
                $s.ws.restURL = plainURL + params;
            }
        }

        /*
         * removes unnecessary properties from the auth params in the pram list
         * @param {params} list of input parameters
         */
        function sanitizeAuthParams(params) {
            _.forEach(params, function (param) {
                if (param[PARAMETER_TYPE_KEY] === $s.ws.paramType.AUTH) {
                    delete param.displayName;
                }
            });
        }

        /*
         * checks the existence of auth params in the params list
         * if found, sets the ws.basicAuthRequired to true
         * @param {params} list of input parameters
         */
        function checkAuthParams(params) {
            _.forEach(params, function (param) {
                if (param[PARAMETER_TYPE_KEY].toUpperCase() === $s.ws.paramType.AUTH.toUpperCase()) {
                    $s.ws.basicAuthRequired = true;

                    // remove the 'wm_auth_' part from the auth parameters
                    param.displayName = param.name.replace('wm_auth_', '');
                }
            });
        }

        /**
         * Checks if the param type exists in App Environment Properties
         * @param paramObj - takes param object as input
         * @param isNewParam - flag which is true for new header or query param
         * @returns {string} - returns class name 'error' if the param is configured as an App Environment Proprety previously, but the property doesn't exists now
         */
        function checkIfAppEnvPropertyExists(paramObj, isNewParam) {
            var type,
                isAppEnvProperty = (paramObj.format || paramObj.type) ? isAppEnvironmentProperty(paramObj.format || paramObj.type) : paramObj[VARIABLE_TYPE] === APP_ENVIRONMENT;

            if (isNewParam) {
                isAppEnvProperty = isAppEnvironmentProperty(paramObj.format || paramObj.type);
                if (!paramObj.format) {
                    paramObj.format = paramObj.type;
                }
            }
            if (isAppEnvProperty) {
                type = (paramObj.format || paramObj.type) ? (paramObj.format || paramObj.type).replace(VARIABLE_APP_ENV, '') : paramObj[VARIABLE_KEY];
                if (!$rs.appEnvironmentProperties.hasOwnProperty(type)) {
                    // setting format to null so that the UI gets updated whenever you add the same App Env property which was deleted
                    paramObj.format = null;
                    return 'error';
                } else {
                    // update param format and type when they are null but the param exists in AppEnvironmemnt properties
                    if (!paramObj.format) {
                        paramObj.format = paramObj.type ? paramObj.type : paramObj[VARIABLE_KEY];
                    }
                    // setting isInvalidParamType flag to false to remove the 'error' class from the new header and query param
                    if (isNewParam) {
                        if (paramObj.in === $s.ws.paramType.HEADER.toLowerCase()) {
                            $s.ws.isInvalidHeaderParamType = false;
                        }
                        if (paramObj.in === $s.ws.paramType.QUERY.toLowerCase()) {
                            $s.ws.isInvalidQueryParamType = false;
                        }
                    }
                }
            }
        }

        /**
         * set the title of select widget if the param type is invalid
         * @param paramObj   - takes param object as input
         * @param isNewParam - boolean value which is true if it is a new Header or Query Param
         * @returns {string} - returns a message if the param type doesn't exists in the App Environment Properties
         */
        function setTitleMessage(paramObj, isNewParam) {
            if (isNewParam) {
                // Show the title only if the new Param is invalid
                if ((paramObj.name !== '' && paramObj.in === $s.ws.paramType.HEADER.toLowerCase() && $s.ws.isInvalidHeaderParamType) || (paramObj.name != '' && paramObj.in === $s.ws.paramType.QUERY.toLowerCase() && $s.ws.isInvalidQueryParamType)) {
                    return Utils.replace($s.$root.locale.MESSAGE_EMPTY_PARAM_TYPE, [paramObj.name]);
                } else {
                    return '';
                }
            } else {  // Show the title only if the existing Param is invalid
                if (checkIfAppEnvPropertyExists(paramObj) === 'error') {
                    var type = paramObj.format ? paramObj.format.replace(VARIABLE_APP_ENV, '') : paramObj[VARIABLE_KEY];
                    return Utils.replace($s.$root.locale.MESSAGE_WEBSERVICES_INVALID_PARAM_TYPE, [type]);
                } else {
                    return '';
                }
            }
        }
        /*
        * Build and append formdata to connection params
        * */
        function addFormData(connectionParams) {
            var bodyFormData = getFormDataForParams();
            connectionParams.data.multiParamInfoList = getMultiParamInfoList();
            bodyFormData.append(SWAGGER_CONSTANTS.WM_HTTP_JSON, new Blob([JSON.stringify(connectionParams.data)], {
                type: 'application/json'
            }));
            connectionParams.data = bodyFormData;
        }
        /**
         * Hits a http request to the provided rest service
         * The request can be made through PROXY or DIRECTLY depending on useProxy flag
         * @param connectionParams
         * @param success
         * @param error
         */
        function requestRestEndpoint(connectionParams, success, error) {
            var bodyFormData,
                params,
                isMultipartRequest = connectionParams.data.contentType === WS_CONSTANTS.CONTENT_TYPES.MULTIPART_FORMDATA;
            connectionParams.isDirectCall = !$s.ws.useProxyForWeb;
            if ($s.ws.useProxyForWeb) {
                if (isMultipartRequest) {
                    //Build and append formdata to connection params
                    addFormData(connectionParams);
                    _.set(connectionParams, 'headers.Content-Type', undefined);
                }
                WebService.testRestService(connectionParams, success, error);
            } else {
                params = {
                    url: connectionParams.data.endpointAddress,
                    method: connectionParams.data.method,
                    headers: connectionParams.data.headers || {},
                    isDirectCall: true
                };
                if ($s.ws.withCredentials) {
                    params.withCredentials = true;
                } else {
                    delete params.withCredentials;
                }
                if (isMultipartRequest) {
                    params.dataParams = getFormDataForParams();
                    params.headers['Content-Type'] = undefined;
                } else if (!$s.ws.isNonBodyMethodSelected) {
                    params.headers['Content-Type'] = connectionParams.data.contentType;
                    params.dataParams = connectionParams.data.requestBody;
                }
                WebService.invokeJavaService(params, success, error);
            }
        }

        /**
         * process the response returned by a rest endpoint
         * if the response is XML, it is converted to JSON.
         *  The same will be passed on to backend for meta data generation.
         * @param responseText
         */
        function processRestResponse(responseText) {
            var jsonResponse = Utils.getValidJSON(responseText),
                editorType = 'text';

            // if response is JSON, prettify it
            if (jsonResponse) {
                responseText = JSON.stringify(jsonResponse, null, '\t');
                editorType = 'json';
            } else {
                jsonResponse = Utils.xmlToJson(responseText);
                if (jsonResponse) {
                    $s.ws.sampleHttpResponseDetails.convertedResponse = JSON.stringify(jsonResponse);
                    editorType = 'xml';
                }
            }

            // if converted response is received in JSON, cache it for later use
            sampleResponse = jsonResponse || null;

            // set response body for editor content
            setEditorType(editorType);
            $s.ws.editorContent = responseText;
        }

        /**
         * Test REST service success handler
         * call 'processRestResponse' to handle response text
         * @param response
         * @param xhrObj
         */
        function restRequestSuccess(connectionParams, response, xhrObj) {
            var responseText,
                statusCode = _.get(response, 'statusCode') || _.get(xhrObj, 'status');
            //the proxy call will give you 200 even if the statusCode is 401 or 403
            if (_.includes([WS_CONSTANTS.HTTP_STATUS_CODE.UNAUTHORIZED, WS_CONSTANTS.HTTP_STATUS_CODE.FORBIDDEN], statusCode)) {
                restRequestError(connectionParams, undefined, xhrObj);
                return;
            }
            if ($s.ws.useProxyForWeb) {
                // persist the test response
                $s.ws.sampleHttpResponseDetails = response || {};
                responseText = $s.ws.sampleHttpResponseDetails.responseBody;
                processRestResponse(responseText);
            } else {
                $s.ws.sampleHttpResponseDetails = {
                    responseBody: response
                };
                if (xhrObj && _.isFunction(xhrObj.headers)) {
                    $s.ws.sampleHttpResponseDetails.headers = xhrObj.headers();
                }
                responseText = response;
                processRestResponse(responseText);
            }
            populateRestService(function () {
                $s.toggleMessage(false);
                // set the service tested flag
                $s.ws.serviceTested = true;
                // set isUrlTested flag to true inorder to enable the save button when the service is tested and is successful
                $s.ws.isUrlTested = true;
            });
        }

        /**
         * Test REST Service error handler
         * if for Mobile project CORS error is revieved:
         *  - hit the call through proxy
         * @param error
         * @param details
         */
        function restRequestError(connectionParams, error, details) {
            var responseText, errResponse, editorType = 'text';
            $s.toggleMessage(false);
            $s.ws.serviceTested = false;
            // set isUrlTested flag to false inorder to disable the save button when there is an error while testing the service
            $s.ws.isUrlTested = false;
            function isCORSFailure(errInfo) {
                /*
                 * In case an http request(over https) is made without proxy
                 * browsers like Chrome and Mozilla return a status code -1
                 * IE does not return any status code, so relying on the description "Access is Denied"
                 */
                var ieCorsRex = /access (is )?denied/i;
                return (errInfo.status === WS_CONSTANTS.HTTP_STATUS_CODE.CORS_FAILURE || (Utils.isIE() && ieCorsRex.test(errInfo.description)));
            }

            /**
             * fallback to proxy for mobile projects, if a direct call fails sue to scenarios where status code is not received like:
             *  http call is made over https. Firefox version <50 is not allowing it.
             * @returns {boolean}
             */
            function directCallFailureInMobile() {
                return $rs.isMobileApplicationType && connectionParams.isDirectCall && WM.isUndefined(details.status);
            }
            if (isCORSFailure(details) || directCallFailureInMobile()) {
                // For Mobile project, if CORS issue found, fallback to using proxy
                if ($rs.isMobileApplicationType) {
                    $s.ws.useProxyForWeb = true;
                    requestRestEndpoint(connectionParams, restRequestSuccess.bind(undefined, connectionParams), restRequestError.bind(undefined, connectionParams));
                    return;
                }
                responseText = $rs.locale.MSG_CORS_FAILURE;
            } else {
                if (!connectionParams.isDirectCall) {
                    var errMsg = error || _.get(details, 'data.responseBody');
                    responseText = Utils.getValidJSON(errMsg);
                    if (responseText) {
                        responseText = JSON.stringify(responseText, null, '\t');
                        editorType = 'json';
                    } else {
                        responseText = error;
                    }
                } else {
                    errResponse = _.get(details, 'data');
                    responseText = Utils.getValidJSON(errResponse);
                    if (responseText) {
                        responseText = JSON.stringify(responseText, null, '\t');
                        editorType = 'json';
                    } else {
                        responseText = errResponse || error;
                    }
                }
            }

            if (_.get(details, 'data.statusCode') === WS_CONSTANTS.HTTP_STATUS_CODE.UNAUTHORIZED) {
                error = WS_CONSTANTS.HTTP_STATUS_CODE_MESSAGES[WS_CONSTANTS.HTTP_STATUS_CODE.UNAUTHORIZED];
            }
            if ($s.ws.oAuthRequired) {
                oAuthProviderService.removeAccessToken($s.ws.oAuthProviderId);
            }
            if (error === "Service call failed") {
                error = undefined;
            }
            $s.handleError(error, { 'fallbackMsg': 'MESSAGE_ERROR_WEB_SERVICE_TEST' });
            setEditorType(editorType);
            $s.ws.editorContent = responseText;
        }
        /*
        * Filter multipart params from full list
        * */
        function getMultipartParams() {
            return _.filter($s.ws.editMode ? $s.ws.inputParams : $s.ws.multipartParams, [PARAMETER_TYPE_KEY, $s.ws.paramType.FORMDATA]);
        }
        /*
        * Constructs form data for all the multipart params
        * */
        function getFormDataForParams() {
            var formData = new FormData();
            _.forEach(getMultipartParams(), function (obj) {
                Utils.getFormData(formData, obj, $s.ws.editMode ? $s.ws.restInfoMultipart[obj.name] : obj.value);
            });
            return formData;
        }
        /*
        * Fetch the value from model based on the workspace mode
        * */
        function getTestValue(param) {
            return $s.ws.editMode ? $s.ws.restInfoMultipart[param.name] : param.value;
        }
        /*
        * Returns array of param meta data
        * */
        function getMultiParamInfoList() {
            var paramList = [];
            _.forEach(getMultipartParams(), function (obj) {
                var paramType = obj.type === 'array' ? obj.items.type : obj.type;
                paramList.push({
                    name: obj.name,
                    type: paramType,
                    list: obj.list || obj.type === 'array',
                    testValue: paramType !== 'file' ? getTestValue(obj) : undefined,
                    contentType: _.includes(primitiveMultipartTypes, obj[CONTENT_TYPE_KEY]) ? undefined : obj[CONTENT_TYPE_KEY]
                });
            });
            return paramList;
        }

        //Replace query and path params with their values
        function getUrlWithParamValues(url) {
            var pathParams = $s.$eval('ws.inputParams | filter: {in: ws.paramType.PATH}');
            if ($s.ws.restInfoQuery) {
                _.forEach($s.ws.restInfoQuery, function (value, key) {
                    url = url.replace('{' + key + '}', value);
                });
            }
            if (!_.isEmpty(pathParams)) {
                $s.ws.restInfoPaths = $s.ws.restInfoPaths || {};
                _.forEach(pathParams, function (param) {
                    url = url.replace('{' + param.name + '}', $s.ws.restInfoPaths[param.name]);
                });
            }
            return url;
        }

        /**
         * this function removes the given parameter from the given url
         * @param sourceURL
         * @param paramName
         * @returns {*}
         */
        function removeParameterFromURL(sourceURL, paramName) {
            var url = sourceURL.split("?")[0],
                param,
                params_arr = [],
                queryString = (sourceURL.indexOf("?") !== -1) ? sourceURL.split("?")[1] : "";
            if (queryString !== "") {
                params_arr = queryString.split("&");
                for (var i = params_arr.length - 1; i >= 0; i -= 1) {
                    param = params_arr[i].split("=")[0];
                    if (param === paramName) {
                        params_arr.splice(i, 1);
                    }
                }
                url = url + "?" + params_arr.join("&");
            }
            return url;
        }

        /**
         * this function edits the given url with the paramValue respective to the paramName
         * @param sourceURL
         * @param paramName
         * @param paramValue
         * @returns {*}
         */
        function editParameterInURL(sourceURL, paramName, paramValue) {
            var url = sourceURL.split("?")[0],
                param,
                params_arr = [],
                queryString = (sourceURL.indexOf("?") !== -1) ? sourceURL.split("?")[1] : "";
            if (queryString !== "") {
                params_arr = queryString.split("&");
                for (var i = params_arr.length - 1; i >= 0; i -= 1) {
                    param = params_arr[i].split("=")[0];
                    if (param === paramName) {
                        params_arr[i] = param + '=' + paramValue;
                        break;
                    }
                }
                url = url + "?" + params_arr.join("&");
            }
            return url;
        }

        /**
         * this function edits the parameter in the rest url
         * @param param
         * @param value
         */
        function editParamterValueInURL(param, value) {
            // set the serviceTested flag to true inorder to enable save when there is any change in param value
            $s.ws.serviceTested = true;
            if (!$s.ws.activeServiceType || !$s.ws.editMode) {
                $s.ws.restURL = editParameterInURL($s.ws.restURL, param.name, value);
                return;
            }
            $s.ws.webSocketUrl = editParameterInURL($s.ws.webSocketUrl, param.name, value);
        }

        /**
         * this function adds the accessToken Parameter to the endpoint address if oauth is required and sendAccessToken is at Query
         * @param url
         * @returns {*}
         */
        function getEndpointRestURL(url) {
            url = url || $s.ws.restURL;
            var accessToken;
            if ($s.ws.oAuthRequired && $s.ws.oAuthProvider.sendAccessTokenAs === $s.ws.paramType.QUERY) {
                accessToken = oAuthProviderService.getAccessToken($s.ws.oAuthProviderId);
                $s.ws.restInfoQuery['access_token'] = accessToken;
                url = removeParameterFromURL(url, 'access_token');
                return url + (url.indexOf('?') === -1 ? '?' : '&') + 'access_token=' + accessToken;
            }
            return url;
        }

        /**
         * this function assigns active oauth provider
         */
        function assignActiveOAuthProvider(providerId) {
            $s.ws.oAuthProvider = _.find($s.OAUTH_PROVIDERS, { providerId: providerId || $s.ws.oAuthProviderId });
        }

        /**
         * Initiate testing a REST service with provided configurations
         * Prepare the config object
         * disable useProxy if any param is configured as a server side property
         * call the 'requestRestEndpoint' function that decides whether to hit the service through proxy or directly
         */
        function testRestService(token) {
            var accessToken,
                endpointAddress,
                isValidParam = true;

            if ($s.ws.oAuthRequired) {
                if (!$s.ws.oAuthProviderId) {
                    wmToaster.error($rs.locale.MESSAGE_ERROR_TITLE, $rs.locale.MESSAGE_ERROR_NO_SELECTED_OAUTH_PROVIDER);
                    return;
                }
                accessToken = oAuthProviderService.getAccessToken($s.ws.oAuthProviderId);
                if (!accessToken && token !== 'error') {
                    $s.toggleSpinner(true);
                    if ($s.ws.oAuthProvider && ($s.ws.oAuthProvider.oauth2Flow.toLowerCase() === 'implicit' || _.get($s.ws.oAuthProvider, 'oAuth2Pkce.enabled') === true)) {
                        var authURL = $s.ws.oAuthProvider.oauth2Flow;
                        oAuthProviderService.performAuthorization(authURL, $s.ws.oAuthProviderId, testRestService, '', $s.ws.oAuthProvider);
                    } else {
                        oAuthProviderService.performAuthorization($s.authorizationUrl, $s.ws.oAuthProviderId, testRestService);
                    }
                    return;
                } else {
                    $s.toggleSpinner(false);
                }
            }

            endpointAddress = getUrlWithParamValues($s.ws.restURL);
            $s.ws.headers = $s.ws.restInfoHeaders || {};

            if ($s.ws.restURL === '') {
                $s.toggleMessage(true, $rs.locale.MESSAGE_WEBSERVICE_IMPORT_FIELD_MISSING + $rs.locale.LABEL_WEB_SERVICE_REST_SERVICE_URL, 'error');
                return;
            }
            //Add the last unpushed param if there exists any
            addParam($s.ws.paramType.FORMDATA);
            $s.toggleMessage(true, $rs.locale.MESSAGE_WEB_SERVICE_TEST, 'loading');
            // if new header is entered but not added, consider it as well
            if ($s.ws.newHeaderParam.name) {
                isValidParam = addNewHeaderParam();
                // if the header param is not valid then prevent testing the service
                if (!isValidParam) {
                    return;
                }
            }
            // if new query param is entered but not added, consider it as well
            if ($s.ws.newQueryParam.name) {
                isValidParam = addNewQueryParam();
                // if the query param is not valid then prevent testing the service
                if (!isValidParam) {
                    return;
                }
            }

            // check if the param type exists in App Environment Properties
            _.some($s.ws.inputParams, function (paramObj) {
                if (checkIfAppEnvPropertyExists(paramObj) === 'error') {
                    $s.ws.serviceTested = false;
                    isValidParam = false;
                    $s.toggleMessage(true, Utils.replace($s.$root.locale.MESSAGE_EMPTY_PARAM_TYPE, [paramObj.name]), 'error');
                    return true;
                }
            });
            if (!isValidParam) {
                return;
            }

            assignActiveOAuthProvider();
            /*TODO: to fix the url encoding issues, right now sending normal url without encoding*/
            var connectionParams = {
                //endpointAddress: encodeURI($scope.ws.restURL),
                'data': {
                    'endpointAddress': Utils.encodeUrlParams(getEndpointRestURL(endpointAddress)),
                    'method': $s.ws.serviceMethod,
                    'contentType': $s.ws.contentType,
                    'requestBody': $s.ws.requestBody,
                    'headers': $s.ws.headers || {}
                },
                'urlParams': {
                    'projectID': $rs.project.id,
                    'optimizeResponse': true // Now hardcoded. Introduce a flag in the UI ad use that instead
                }
            };
            // Adding the authorization key in the headers only if service needs the basic http Authentication
            if ($s.ws.basicAuthRequired) {
                authString = 'Basic ' + $base64.encode($s.ws.userName + ':' + $s.ws.password);
                connectionParams.data.headers.Authorization = authString;
                connectionParams.data.authDetails = {
                    "type": AUTH_TYPE_BASIC
                };
            } else if ($s.ws.oAuthRequired) {
                authString = 'Bearer ' + accessToken;
                connectionParams.data.headers.Authorization = authString;
                connectionParams.data.authDetails = {
                    "type": AUTH_TYPE_OAUTH,
                    "providerId": $s.ws.oAuthProviderId
                };
            } else {
                connectionParams.data.authDetails = null;
            }

            // for mobile apps, always start with a direct call
            $s.ws.useProxyForWeb = $s.ws.useProxy;
            requestRestEndpoint(connectionParams, restRequestSuccess.bind(undefined, connectionParams), restRequestError.bind(undefined, connectionParams));
        }

        // populate the data for the service
        function populateRestService(callBack) {
            if ($s.editMode) {
                $s.ws.headers = $s.ws.headers || {};
            }
            if ($s.ws.restURL === '') {
                $s.toggleMessage(true, $rs.locale.MESSAGE_WEBSERVICE_IMPORT_FIELD_MISSING + $rs.locale.LABEL_WEB_SERVICE_REST_SERVICE_URL, 'error');
                return;
            }
            $s.toggleMessage(true, $rs.locale.MESSAGE_WEB_SERVICE_POPULATE, 'loading');
            // process the edited sample response
            var editedResponse = $s.ws.editorContent,
                sampleJsonResponse = Utils.getValidJSON(editedResponse),
                connectionParams;

            editedResponse = sampleJsonResponse ? JSON.stringify(sampleJsonResponse) : editedResponse;
            $s.ws.sampleHttpResponseDetails.responseBody = editedResponse;

            connectionParams = {
                'data': {
                    //endpointAddress: encodeURI($scope.ws.restURL),
                    'endpointAddress': getEndpointRestURL(),
                    'method': $s.ws.serviceMethod,
                    'contentType': $s.ws.contentType,
                    'requestBody': $s.ws.requestBody,
                    'headers': $s.ws.headers,
                    'sampleHttpResponseDetails': $s.ws.sampleHttpResponseDetails
                },
                'urlParams': {
                    'projectID': $s.project.id
                }
            };

            if ($s.ws.basicAuthRequired) {
                connectionParams.data.headers.Authorization = authString;
                connectionParams.data.authDetails = { "type": AUTH_TYPE_BASIC };
            } else if ($s.ws.oAuthRequired) {
                connectionParams.data.headers.Authorization = authString;
                connectionParams.data.authDetails = {
                    "type": AUTH_TYPE_OAUTH,
                    "providerId": $s.ws.oAuthProviderId
                };
            } else {
                connectionParams.data.authDetails = null;
            }
            if ($s.ws.contentType === WS_CONSTANTS.CONTENT_TYPES.MULTIPART_FORMDATA) {
                connectionParams.data.multiParamInfoList = getMultiParamInfoList();
            }
            WebService.populateRestService(connectionParams, function (response) {
                restRequestFormat = response;
                processServiceSettings(response, $s.ws.editMode, true);
                Utils.triggerFn(callBack);
            }, function (error) {
                $s.handleError(error, { 'fallbackMsg': 'MESSAGE_ERROR_WEB_SERVICE_POPULATE' });
            });
        }

        /**
         * set the VARIABLE_KEY and VARIABLE_TYPE properties of a param (Header or Query) based on its type and changing the type to 'string' if the param is configured as a server side property
         * if param is server side property => param['x-WM-VARIABLE_TYPE]='SERVER', param['x-WM-VARIABLE_KEY]=value and param.type = 'string'
         * if param is app env property => param['x-WM-VARIABLE_TYPE]='APP_ENVIRONMENT', param['x-WM-VARIABLE_KEY]=value and param.type = 'string'
         * if param is ui type property => param['x-WM-VARIABLE_TYPE]='PROMPT', param['x-WM-VARIABLE_KEY]='' and param.type = value
         *
         */
        function setVariableTypeAndKey(paramObj, paramType) {
            var obj = isServerSideProperty(paramType);
            if (obj) {
                paramObj[VARIABLE_TYPE] = SERVER;
                paramObj[VARIABLE_KEY] = obj.value;
                paramObj.format = obj.value;
                paramObj.type = SERVICE_TYPES.STRING;
                if (obj.value === 'DATETIME') {
                    paramObj[VARIABLE_KEY] = 'DATE_TIME';
                }
            } else if (isAppEnvironmentProperty(paramType)) {
                paramObj[VARIABLE_TYPE] = APP_ENVIRONMENT;
                paramObj[VARIABLE_KEY] = paramType.replace(VARIABLE_APP_ENV, '');
                paramObj.format = paramType;
                paramObj.type = SERVICE_TYPES.STRING;
            } else { // If param is a UI type property
                paramObj[VARIABLE_TYPE] = PROMPT;
                paramObj[VARIABLE_KEY] = '';
                if (WM.isUndefined(paramObj.format)) {
                    paramObj.format = paramType;
                }
                // set the type of param based on format
                setTypeBasedOnFormat(paramObj);
            }
        }
        /*
        * set content type for string/file type params for model purpose
        * */
        function setContentType(params) {
            var paramType;
            _.forEach(params, function (param) {
                paramType = _.get(param, 'items.type') || param.type;
                if ((param[PARAMETER_TYPE_KEY] === $s.ws.paramType.FORMDATA) && _.includes(primitiveMultipartTypes, paramType) && !param[CONTENT_TYPE_KEY]) {
                    param[CONTENT_TYPE_KEY] = paramType;
                }
            });
        }

        /*
        * Remove content type for string/file type params
        * */
        function removeContentType(params) {
            _.forEach(params, function (param) {
                if (_.includes(primitiveMultipartTypes, param[CONTENT_TYPE_KEY])) {
                    param[CONTENT_TYPE_KEY] = undefined;
                }
            })
        }

        /**
         * processes the settings received for a REST/WebSocket service from the backend
         * the method is called in three scenarios
         * - after clicking on Next(Step 2) -- skipExtractInfo is false
         * - when an existing service is opened for editing and tested with changes, skipExtractInfo is false
         * - when an existing service is modified and saved:
         *   * in this case, this is an intermediate step b/w test and save.
         *   * here, info extraction sent from backend is not required -- skipExtractInfo is true
         *
         * @param settings
         * @param skipExtractInfo
         */
        function processServiceSettings(settings, skipExtractInfo, extendInputParams) {
            var pathObject = settings.swagger.paths[Object.keys(settings.swagger.paths)[0]],
                operationObject = pathObject[Object.keys(pathObject)[0]],
                existingInputParams = Utils.getClonedObject($s.ws.inputParams);

            operationObject.parameters = operationObject.parameters || [];
            // if skipExtractInfo flag is set,
            // then info extraction sent from backend is not required
            if (!skipExtractInfo) {
                $s.ws.restURL = getParameterizedUrl(settings.swagger);
                $s.ws.serviceName = settings.serviceId;
            }
            if (extendInputParams) {
                $s.ws.inputParams = operationObject.parameters;
                //push the additional params not existing in swagger response.
                _.forEach(existingInputParams, function (parameterObj) {
                    var inputObj = _.find($s.ws.inputParams, { name: parameterObj.name });
                    var paramObj = _.find(existingInputParams, { name: parameterObj.name });
                    // changing the type of param based on its format (since type is configured as 'string' for server side properties)
                    if (inputObj) {
                        inputObj.type = paramObj.format || inputObj.type;
                        //update the items.type for the params only if content type is not multipart/form-data
                        if (inputObj.items && inputObj.in !== $s.ws.paramType.FORMDATA) {
                            inputObj.items.type = inputObj.type;
                        }
                    } else {
                        $s.ws.inputParams.push(parameterObj);
                    }
                });
                _.forEach($s.ws.inputParams, function (parameterObj) {
                    // update the type of header param
                    if (parameterObj.in === $s.ws.paramType.HEADER.toLowerCase()) {
                        parameterObj.type = $s.ws.cachedHeaderParamsType[parameterObj.name] ? $s.ws.cachedHeaderParamsType[parameterObj.name] : parameterObj.type;
                        parameterObj.items = {};
                        parameterObj.items.type = parameterObj.type;
                    }
                });
            }
            setParameterizedUrl($s.ws.inputParams);
            $s.ws.operationName = operationObject[WS_CONSTANTS.OPERATION_NAME_KEY];
            $s.ws.contentType = operationObject.consumes ? operationObject.consumes[0] : '';
            $s.ws.onContentTypeChange();
            $s.toggleMessage(false);

            // check auth params existence in the input params
            checkAuthParams($s.ws.inputParams);

            //set content type for string/file type params for model purpose
            setContentType($s.ws.inputParams);

            // cache the param test values for default service variables
            cacheParamValues();
            // cache the header param types
            cacheHeaderParamsType();
        }

        /*
         * clears all the parameters of the specified type from the params collection
         * @param type param type to be cleared
         */
        function clearParams(type) {
            // initialize the parameter index from the end of the array
            var index = $s.ws.inputParams.length;
            while (index--) {
                if ($s.ws.inputParams[index][PARAMETER_TYPE_KEY] === type.toLowerCase()) {
                    $s.ws.inputParams.splice(index, 1);
                }
            }
        }

        // watch on the URL to check path params
        function handleUrlChange(url, init, type) {
            var paramKeys;
            var isWebSocket = type === 'websocket' || $s.activeWebServiceType === 'WEBSOCKET';
            url = url || isWebSocket ? $s.ws.webSocketUrl : $s.ws.restURL;
            // if parameterized url not set previously, return
            if (!url) {
                return;
            }
            $s.ws.restInfoQuery = assignQueryParamsFromURL(url);
            paramKeys = Object.keys($s.ws.restInfoQuery);
            $s.ws.inputParams = $s.ws.inputParams || [];
            if (!init) {
                //remove the inputparams changed via URL
                _.remove($s.ws.inputParams, function (paramObj) {
                    return (paramObj.in === $s.ws.paramType.PATH.toLowerCase() || paramObj.in === $s.ws.paramType.QUERY.toLowerCase()) && !_.includes(paramKeys, paramObj.name);
                });
                // if the url is changed then disable save until the service is tested
                $s.ws.isUrlChanged = true;
                $s.ws.isUrlTested = false;
            }
            _.forEach($s.ws.restInfoQuery, function (paramValue, param) {
                if (!_.find($s.ws.inputParams, { name: param })) {
                    $s.ws.inputParams.push({
                        'name': param,
                        'in': $s.ws.paramType.QUERY.toLowerCase(),
                        'type': SERVICE_TYPES.STRING,
                        'format': SERVICE_TYPES.STRING
                    });
                }
            });
            if (!init) {
                //assign path params from the url
                clearParams($s.ws.paramType.PATH.toLowerCase());
            }
            url = url.split('?')[0];
            url.replace(/\{(.*?)\}/g, function (match, param) {
                $s.ws.newPathParam.name = param;
                $s.ws.newPathParam[TYPE_KEY] = SERVICE_TYPES.STRING;
                $s.ws.serviceTested = false;
                $s.addParam($s.ws.paramType.PATH);
                switchTab($s.ws.paramType.PATH, $s.ws.activeServiceType === 'WebSocketService' ? true : false);
            });
            // to disable save when url is changed
            $s.ws.serviceTested = false;
        }


        // decrements the current stepCount of REST service configuration
        function decrementStep() {
            $s.ws.stepCount -= 1;
        }

        function processRequestBodyForImport(requestBody, type) {
            // get the customized relative URL (if path params embedded)
            var parameterizedUrl = type === 'websocket' ? $s.ws.webSocketUrl : $s.ws.restURL,
                urlProtocol,
                relativeUrl,
                slashIndex,
                index,
                endpoints,
                i,
                nEndpoints,
                j,
                nOperations,
                pathKey,
                pathObj,
                connectionParams,
                operationObject;

            parameterizedUrl = parameterizedUrl.split('://');
            urlProtocol = parameterizedUrl[0];
            parameterizedUrl = parameterizedUrl[1];
            requestBody.swagger.schemes[0] = urlProtocol;

            slashIndex = parameterizedUrl.indexOf('/');
            slashIndex = slashIndex === -1 ? parameterizedUrl.indexOf('?') : slashIndex;
            slashIndex = slashIndex === -1 ? parameterizedUrl.length : slashIndex;
            requestBody.swagger.host = parameterizedUrl.substr(0, slashIndex);
            relativeUrl = parameterizedUrl.substr(slashIndex, parameterizedUrl.length);
            index = relativeUrl.indexOf('?') !== -1 ? relativeUrl.indexOf('?') : relativeUrl.length;
            relativeUrl = relativeUrl.substring(0, index) || '/';
            // requestBody.swagger.basePath = relativeUrl;
            pathKey = _.keys(requestBody.swagger.paths)[0];
            pathObj = requestBody.swagger.paths[pathKey];
            operationObject = pathObj[_.keys(pathObj)[0]];
            operationObject.parameters = operationObject.parameters || [];
            operationObject.parameters = transformQueryParam(operationObject.parameters);

            //Remove content type for string/file type params
            removeContentType(operationObject.parameters);

            requestBody.proxySettings = {
                'web': $s.ws.useProxyForWeb ? RUNTIME_CALL_MODE.PROXY : RUNTIME_CALL_MODE.DIRECT, // for web api, use proxy settings with which the call was made.
                'mobile': $s.ws.useProxy ? RUNTIME_CALL_MODE.PROXY : RUNTIME_CALL_MODE.DIRECT, // for mobile api, use whatever is selected in the designer.
                'withCredentials': $s.ws.withCredentials ? true : false // If direct call, then withCredentials flag should be sent or not.
            };

            // if authentication enabled, remove unnecessary properties from params list
            if ($s.ws.basicAuthRequired) {
                sanitizeAuthParams($s.ws.inputParams);
            }
            if (!$s.isEdnApiImport) {
                requestBody.projectId = $rs.project.id;
                requestBody.serviceId = $s.ws.serviceName;

                /*
                 * NOTE: Only one entity required as relative path for an operation in a swagger object
                 * For newly created swaggers, relativePath is stored in BASE_PATH_KEY and RELATIVE_PATH_KEY is empty(or "/")
                 * For old swaggers migrated to 2.0, relativePath is present in RELATIVE_PATH_KEY and BASE_PATH_KEY is null
                 * Thus, for consistency, while saving we are just keeping BASE_PATH_KEY as relative path for operation
                 */
                pathObj[BASE_PATH_KEY] = relativeUrl;
                pathObj[RELATIVE_PATH_KEY] = '';

                // Change the Variable_key and Variable_Type based on the type of the parameter
                _.forEach(pathObj, function (obj) {
                    _.forEach(obj.parameters, function (paramObj) {
                        setVariableTypeAndKey(paramObj, paramObj.type);
                    });
                });
                requestBody.swagger.paths = {};
                requestBody.swagger.paths[relativeUrl] = Utils.getClonedObject(pathObj);
                // update the param type based on the format (since by default, type is set as 'string' for server side properties in the request body)
                _.forEach($s.ws.inputParams, function (paramObj) {
                    paramObj.type = paramObj.format;
                    // update items.type for header params only if content type is not multipart/form-data
                    if (paramObj.items && paramObj.in !== $s.ws.paramType.FORMDATA) {
                        paramObj.items.type = paramObj.type;
                    }
                });
                //requestBody.swagger.paths[pathKey] = pathObj;
            } else {
                requestBody.serviceId = $s.ws.serviceName;
                endpoints = requestBody.swagger.paths;
                // update only the required endpoint and operation based on the filteredEndpoint and filteredOperation ids
                for (i = 0, nEndpoints = endpoints.length; i < nEndpoints; i++) {
                    if (endpoints[i].id === requestBody.filteredEndPointId) {
                        endpoints[i].relativePath = relativeUrl;
                        for (j = 0, nOperations = endpoints[i].operations.length; j < nOperations; j++) {
                            if (endpoints[i].operations[j].id === requestBody.filteredOperationId) {
                                endpoints[i].operations[j].methodType = $s.ws.serviceMethod;
                                endpoints[i].operations[j].consumes = $s.ws.contentTypeKey ? [$s.ws.contentTypeMap[$s.ws.contentTypeKey]] : [];
                                break;
                            }
                        }
                        break;
                    }
                }
            }

            connectionParams = {
                'data': requestBody,
                'urlParams': {
                    'projectID': $s.project.id
                }
            };
            return connectionParams;
        }

        /*
         * sends backend call to import a REST service
         * @param {isNewService} flag determining if the service is a new one
         * @param {success} success callback
         * @param {error} error callback
         */
        function buildRestService(isNewService, success, error) {
            // show missing field error message and return, check for service url first, then service name and then operation name
            // trim is used to handle the case where user enters unnecessary spaces
            if (!$s.ws.restURL.trim()) {
                Utils.triggerFn(error, $rs.locale.MESSAGE_WEBSERVICE_IMPORT_FIELD_MISSING + $rs.locale.LABEL_WEB_SERVICE_REST_SERVICE_URL);
                return;
            }
            if (!$s.ws.serviceName.trim()) {
                Utils.triggerFn(error, $rs.locale.MESSAGE_WEBSERVICE_IMPORT_FIELD_MISSING + $rs.locale.LABEL_SERVICE_NAME);
                return;
            }

            //hide error message when all fields are entered correctly
            $s.toggleMessage(true, (isNewService ? $rs.locale.MESSAGE_IMPORT_WEBSERVICE : $rs.locale.MESSAGE_UPDATING_WEBSERVICE), 'loading');
            $s.ws.serviceId = $s.ws.serviceName;

            WebService[isNewService ? 'buildRestService' : 'updateRestService'](processRequestBodyForImport(restRequestFormat), function (response) {
                setContentType($s.ws.inputParams);
                // change the param type based on x-WM-VARIABLE_TYPE
                setParamTypeBasedOnVariableType();
                $s.toggleMessage(false);
                Utils.triggerFn(success, response);
            }, function (errorMsg) {
                $s.toggleMessage(false);
                Utils.triggerFn(error, errorMsg);
            });
        }

        function updateRestService(success, error) {
            var isValidParam = true;
            $s.ws.headers = $s.ws.restInfoHeaders || {};
            // if a new header is entered but not added, consider it as well
            if ($s.ws.newHeaderParam.name) {
                //Add the last unpushed header param if there exists any
                addParam($s.ws.paramType.FORMDATA);
                isValidParam = addNewHeaderParam();
                // if the header param is not valid then prevent updating the service
                if (!isValidParam) {
                    return;
                }
            }

            // if new query param is entered but not added, consider it as well
            if ($s.ws.newQueryParam.name) {
                //Add the last unpushed query param if there exists any
                addParam($s.ws.paramType.FORMDATA);
                isValidParam = addNewQueryParam();
                // if the query param is not valid then prevent updating the service
                if (!isValidParam) {
                    return;
                }
            }

            // check if the param type exists in App Environment Properties
            _.some($s.ws.inputParams, function (paramObj) {
                if (checkIfAppEnvPropertyExists(paramObj) === 'error') {
                    $s.ws.serviceTested = false;
                    isValidParam = false;
                    $s.toggleMessage(true, Utils.replace($s.$root.locale.MESSAGE_EMPTY_PARAM_TYPE, [paramObj.name]), 'error');
                    return true;
                }
            });
            if (!isValidParam) {
                return;
            }

            populateRestService(function () {
                buildRestService(false, function () {
                    $rs.webServicePropertyChanged = false;
                    wmToaster.show('success', $rs.locale.MESSAGE_SUCCESS_TITLE, $rs.locale.MESSAGE_SUCCESS_WEB_SERVICE_REST_UPDATE);
                    $s.ws.serviceTested = false;
                    // emit event to update the corresponding node in service-tree
                    $rs.$emit('update-web-services-tree-node', $s.ws.serviceName);
                    Utils.triggerFn(success);
                }, function (errMsg) {
                    $s.handleError(errMsg, { 'fallbackMsg': 'MESSAGE_ERROR_WEB_SERVICE_REST_BUILD' });
                    Utils.triggerFn(error, errMsg);
                });
            });
            $s.ws.isUrlChanged = false;
        }

        function importRestService() {
            buildRestService(true, function (response) {
                $s.handleSuccessServiceImport({
                    'serviceId': response,
                    'serviceType': $s.SERVICE_TYPE_REST,
                    'successMsg': 'MESSAGE_SUCCESS_WEB_SERVICE_REST_BUILD',
                    'sampleResponse': sampleResponse,
                    'cachedParams': cachedParams
                });
            }, function (error) {
                $s.handleError(error, { 'fallbackMsg': 'MESSAGE_ERROR_WEB_SERVICE_REST_BUILD' });
            });
        }

        function getParameterizedUrl(swagger) {
            var paths = swagger.paths,
                pathObject = paths[_.keys(paths)[0]];

            return swagger.schemes[0] + '://' + swagger.host + swagger.basePath + pathObject[BASE_PATH_KEY] + pathObject[RELATIVE_PATH_KEY];
        }

        /**
         * this functions fetches the query params based on the url sent
         * @param url
         * @returns {{}}
         */
        function assignQueryParamsFromURL(url) {
            url = url || $s.ws.restURL;

            var queryObject = {},
                allParams = url.split("?")[1],
                queryParams = allParams ? allParams.split("&") : {};

            if (_.isEmpty(queryParams)) {
                return {};
            }

            for (var i = 0; i < queryParams.length; i++) {
                var pair = queryParams[i].split("=");

                // If first entry with this name
                if (typeof queryObject[pair[0]] === "undefined") {
                    queryObject[pair[0]] = decodeURIComponent(pair[1]);
                    // If second entry with this name
                } else if (typeof queryObject[pair[0]] === "string") {
                    var arr = [queryObject[pair[0]], decodeURIComponent(pair[1])];
                    queryObject[pair[0]] = arr;
                    // If third or later entry with this name
                } else {
                    queryObject[pair[0]].push(decodeURIComponent(pair[1]));
                }
            }

            return queryObject;
        }


        /*
         * gets the info for a specified REST service
         * @param {serviceId} target service id
         */
        function getRestServiceInfo(serviceId, successCallback, failureCallback) {
            WebService.getRESTDetails({ 'projectID': $rs.project.id, 'serviceID': serviceId }, function (response) {
                var paths = response.swagger.paths,
                    pathObject = paths[_.keys(paths)[0]],
                    operationObject = pathObject[_.keys(pathObject)[0]],
                    // variable to check if inputParams contain any Server Side or App Environment properties
                    containsServerOrAppEnvProperties = false;
                // show server side properties only for REST services
                if ($s.ws.paramDataTypeGroups.length === 1) {
                    $s.ws.paramDataTypeGroups.push($rs.locale.LABEL_SERVER_SIDE_PROPERTIES);
                    $s.ws.paramDataTypeGroups.push($rs.locale.LABEL_PROPERTY_APPENVPROPERTY);
                }

                restRequestFormat = response;
                operationObject.parameters = operationObject.parameters || [];
                $s.ws.activeTabIndex = 0;
                $s.ws.restURL = getParameterizedUrl(response.swagger);
                $s.ws.inputParams = operationObject.parameters;
                $s.ws.restInfoQuery = response.httpRequestDetails.queryParams || {};
                $s.ws.restInfoHeaders = response.httpRequestDetails.headers || {};
                $s.ws.restInfoMultipart = {};
                $s.ws.restInfoPaths = null;
                $s.ws.requestBody = response.httpRequestDetails.requestBody || '';
                $s.ws.isInvalidQueryParamType = false;
                $s.ws.isInvalidHeaderParamType = false;
                $s.ws.newHeaderParam.format = SERVICE_TYPES.STRING;
                $s.ws.newQueryParam.format = SERVICE_TYPES.STRING;
                $s.setParameterizedUrl($s.ws.inputParams);

                $s.ws.operationName = operationObject[WS_CONSTANTS.OPERATION_NAME_KEY];
                $s.ws.contentType = operationObject.consumes ? operationObject.consumes[0] : '';
                if (!_.includes($s.ws.contentTypeList, $s.ws.contentType)) { //handling custom types
                    $s.ws.contentTypeList.push($s.ws.contentType);
                }
                $s.ws.serviceName = response.serviceId || serviceId;
                $s.ws.serviceMethod = _.keys(pathObject)[0].toUpperCase();
                $s.ws.isNonBodyMethodSelected = _.includes($s.ws.nonBodyMethods, $s.ws.serviceMethod);
                $s.ws.restURL = response.httpRequestDetails.endpointAddress;
                processRestResponse(response.httpRequestDetails.sampleHttpResponseDetails && response.httpRequestDetails.sampleHttpResponseDetails.responseBody);
                $s.ws.sampleHttpResponseDetails = _.get(response.httpRequestDetails, 'sampleHttpResponseDetails');
                $s.ws.basicAuthRequired = _.get(response.httpRequestDetails, 'authDetails.type') === AUTH_TYPE_BASIC ? true : false;
                $s.ws.oAuthRequired = _.get(response.httpRequestDetails, 'authDetails.type') === AUTH_TYPE_OAUTH ? true : false;
                $s.ws.useProxy = $rs.isMobileApplicationType ? response.proxySettings.mobile === RUNTIME_CALL_MODE.PROXY : response.proxySettings.web === RUNTIME_CALL_MODE.PROXY;
                $s.ws.withCredentials = response.proxySettings.withCredentials;
                //Prepare key:value map of multipart params from list
                _.forEach(response.httpRequestDetails.multiParamInfoList, function (param) {
                    $s.ws.restInfoMultipart[param.name] = param.testValue;
                });
                if ($s.ws.oAuthRequired) {
                    //store the providerId as the UI might change the model when rendered
                    oAuthProviderKey = _.get(response.httpRequestDetails, 'authDetails.providerId');
                    assignActiveOAuthProvider(oAuthProviderKey);
                    if ($s.ws.restInfoQuery['access_token']) {
                        delete $s.ws.restInfoQuery['access_token'];
                    }
                    $s.ws.authenticationType = AUTH_TYPE_OAUTH;
                    oAuthProviderService.getAuthorizationUrl({
                        providerId: _.get(response.httpRequestDetails, 'authDetails.providerId')
                    }, function (response) {
                        $s.authorizationUrl = response;
                    });
                    //load oauthproviders only when the auth is oauth type
                } else if ($s.ws.basicAuthRequired) {
                    /* check auth params existence in the input params */
                    $s.ws.authenticationType = AUTH_TYPE_BASIC;
                    checkAuthParams($s.ws.inputParams);
                } else {
                    $s.ws.authenticationType = AUTH_TYPE_NONE;
                }

                loadoAuthProviders();
                // change the param type based on x-WM-VARIABLE_TYPE
                setParamTypeBasedOnVariableType();
                containsServerOrAppEnvProperties = _.find($s.ws.inputParams, function (obj) {
                    return obj[VARIABLE_TYPE] === SERVER || obj[VARIABLE_TYPE] === APP_ENVIRONMENT;
                });

                if (containsServerOrAppEnvProperties && !$s.ws.disableUseProxy) {
                    // disable useProxy for existing Rest Service as one or more params (Header or Query) are configured as server side property
                    $s.ws.disableUseProxy = true;
                } else if (!containsServerOrAppEnvProperties && $s.ws.disableUseProxy) {
                    $s.ws.disableUseProxy = false;
                }
                toggleUseProxy();
                //set content type for string/file type params for model purpose
                setContentType($s.ws.inputParams);
                // cache the header params type
                cacheHeaderParamsType();
                // flags to disable save button when there is any change in the url
                $s.ws.serviceTested = false;
                $s.ws.isUrlTested = false;
                $s.ws.isUrlChanged = false;

                Utils.triggerFn(successCallback);
            }, function (error) {
                $s.ws.restURL = '';
                wmToaster.show('error', $rs.locale.MESSAGE_ERROR_TITLE, error);
                Utils.triggerFn(failureCallback);
            });
        }

        /*
         * Initializes the selected web-service info for display
         * @param serviceID service name
         * @param serviceType service type, e.g. 'WebService'/SERVICE_TYPE_REST
         */
        function getServiceDetails(serviceID, successCallback, failureCallback) {
            // set flag to disable the service name field
            $s.ws.editMode = true;
            getRestServiceInfo(serviceID, successCallback, failureCallback);
            $rs.webServicePropertyChanged = false;
        }

        /*
         * pre-populates the REST service configuration screen with provided options
         * currently being called from 'apidesigncontroller' on Import of an edn-api
         */
        function configureTeamApiImport(ednApiOptions) {
            if (ednApiOptions) {
                var apiDoc = ednApiOptions.apiDoc,
                    endpoint = ednApiOptions.endpoint,
                    operation = ednApiOptions.operation,
                    baseurl = apiDoc.host || '',
                    relativePath = operation.relativePath,
                    paramRex = /(:\.\+)?\s*\}\s*/g;

                relativePath = relativePath ? relativePath.replace(paramRex, '}') : '';
                $s.isEdnApiImport = true;
                $s.ws.stepCount = 1;
                $s.ws.restURL = baseurl + relativePath;

                $s.ws.serviceName = ((apiDoc && apiDoc.name) || '') + operation[WS_CONSTANTS.OPERATION_NAME_KEY];
                $s.ws.serviceMethod = operation.methodType;
                $s.ws.contentType = operation.consumes ? operation.consumes[0] : '';
                $s.ws.operationName = operation[WS_CONSTANTS.OPERATION_NAME_KEY];
                $s.ws.inputParams = operation.parameters;
                $s.ws.contentTypeKey = (operation.methodType !== 'GET' && operation.methodType !== 'HEAD') ? 'APPLICATION_JSON' : '';

                restRequestFormat = {
                    'projectId': $rs.project.id,
                    'serviceId': $s.ws.serviceName,
                    'apiDocument': Utils.getClonedObject(apiDoc),
                    'filteredEndPointId': endpoint.id,
                    'filteredOperationId': operation.id
                };
            }
        }

        // update param types list by adding Server side properties
        function updateServerSideParamTypes(params) {
            _.each(DB_CONSTANTS.SERVER_SIDE_PROPERTIES, function (prop) {
                params.push({
                    uiType: prop.property,
                    type: prop.value,
                    format: prop.value,
                    disable: $s.ws.isOptionDisabled,
                    group: $rs.locale.LABEL_SERVER_SIDE_PROPERTIES
                });
            });
        }

        // update param types list by updating App Environment properties
        function updateAppEnvParamTypes(params, forceClean) {
            if (forceClean) {
                _.remove(params, { group: $rs.locale.LABEL_PROPERTY_APPENVPROPERTY });
            }
            _.each($rs.appEnvironmentProperties, function (value, key) {
                params.push({
                    uiType: key,
                    type: value,
                    format: VARIABLE_APP_ENV + value,
                    disable: $s.ws.isOptionDisabled,
                    group: $rs.locale.LABEL_PROPERTY_APPENVPROPERTY
                });
            });
            $s.ws.hasAppEnvProperties = _.keys($rs.appEnvironmentProperties).length;
            _.forEach($s.ws.inputParams, function (paramObj) {
                // check if the param type exists in app env properties and adds class 'error' if it is not present
                checkIfAppEnvPropertyExists(paramObj);
            });
            // check if the new header or query param type exists in App Env Properties and adds class 'error' if it is not present
            if ($s.ws.newHeaderParam.name) {
                if (checkIfAppEnvPropertyExists($s.ws.newHeaderParam, true) === 'error') {
                    $s.ws.isInvalidHeaderParamType = true;
                }
            }
            if ($s.ws.newQueryParam.name) {
                if (checkIfAppEnvPropertyExists($s.ws.newQueryParam, true) === 'error') {
                    $s.ws.isInvalidQueryParamType = true;
                }
            }
            disableUseProxyBasedOnParamType(false);
        }

        /**
         *  Update list of param (Query Params and Header Params) datatypes
         * @param params
         * returns a list of objects containing UI types, Server Side properties and App Environment properties
         */
        function updateParamDataTypes(params) {
            var hasProperty = false;
            hasProperty = _.find(params, { group: $rs.locale.LABEL_SERVER_SIDE_PROPERTIES });
            // add Server Side Properties if they are not present in the paramDataTypes
            if (!hasProperty) {
                // adding Server Side properties
                updateServerSideParamTypes(params);
            }
            hasProperty = _.find(params, { group: $rs.locale.LABEL_PROPERTY_APPENVPROPERTY });
            // add App Environment Properties if they are not present in the paramDataTypes
            if (!hasProperty) {
                // adding App Environment properties
                updateAppEnvParamTypes(params);
            }
            return params;
        }

        // function to check if the param type is a Server Side property
        function isServerSideProperty(type) {
            return _.find(DB_CONSTANTS.SERVER_SIDE_PROPERTIES, { value: type });
        }

        // function to check if the param type is an App Environment property
        function isAppEnvironmentProperty(type) {
            return _.startsWith(type, VARIABLE_APP_ENV);
        }

        function toggleUseProxy() {
            var containsServerSideProperty = false,
                containsAppEnvProperty = false;
            $s.ws.useProxyForWeb = $s.ws.useProxy;
            $s.ws.paramDataTypes = updateParamDataTypes($s.ws.paramDataTypes);
            // if the last unpushed param is configured as a server side property, and then trying to disable useProxy
            // then changing the param format and type of new param to null
            if (!$s.ws.useProxy) {
                if ($s.ws.newHeaderParam.name !== '' && $s.ws.newHeaderParam.format) {
                    containsServerSideProperty = isServerSideProperty($s.ws.newHeaderParam.format);
                    containsAppEnvProperty = isAppEnvironmentProperty($s.ws.newHeaderParam.format);
                    if (containsServerSideProperty || containsAppEnvProperty) {
                        $s.ws.newHeaderParam.format = null;
                        $s.ws.newHeaderParam.type = null;
                        // set the new Header param type as invalid if it is configured as server side property and Use proxy is disabled
                        $s.ws.isInvalidHeaderParamType = true;
                    }
                }
                if ($s.ws.newQueryParam.name !== '' && $s.ws.newQueryParam.format) {
                    containsServerSideProperty = isServerSideProperty($s.ws.newQueryParam.format);
                    containsAppEnvProperty = isAppEnvironmentProperty($s.ws.newQueryParam.format);
                    if (containsServerSideProperty || containsAppEnvProperty) {
                        $s.ws.newQueryParam.format = null;
                        $s.ws.newQueryParam.type = null;
                        // set the new Query param type as invalid if it is configured as server side property and Use proxy is disabled
                        $s.ws.isInvalidQueryParamType = true;
                    }
                }
            }
        }

        /**
         *  Function which returns Current Date, Time, DateTime and Timestamp values
         * @param paramObj
         * @returns Current Values based on the param type selected
         */
        function getCurrentValuesForServerSideProps(paramObj) {
            var testValue;
            // auto populating the Test Values for Server Side Properties like Current Date, Time , DateTime and Timestamp
            switch (paramObj.format) {
                case DB_CONSTANTS.SERVER_SIDE_PROPERTIES.CURRENT_DATE.value:
                    testValue = moment().format("YYYY-MM-DD");
                    break;
                case DB_CONSTANTS.SERVER_SIDE_PROPERTIES.CURRENT_TIME.value:
                    testValue = moment().format('HH:mm:ss');
                    break;
                case DB_CONSTANTS.SERVER_SIDE_PROPERTIES.CURRENT_DATE_TIME.value:
                    testValue = moment().format('YYYY-MM-DDTHH:mm:ss');
                    break;
                case DB_CONSTANTS.SERVER_SIDE_PROPERTIES.CURRENT_TIMESTAMP.value:
                    testValue = moment().unix().toString();
                    break;
            }
            return testValue;
        }

        /**
         * 1.Change the type of header or query param and disable useProxy if any param is configured as a server side property
         * 2.auto populating the Test Values if param type is changed to a Server Side Property like Current Date, Time , DateTime and Timestamp
         */
        function onParamTypeChange(paramObj) {
            var testValue;
            if (paramObj.format) {
                paramObj.type = paramObj.format;
                // update items.type for header params
                if (paramObj.items) {
                    paramObj.items.type = paramObj.type;
                }
            } else {
                paramObj.format = paramObj.type;
            }
            // set serviceTested flag to true inorder to enable save button when there is any change in param type
            $s.ws.serviceTested = true;
            // update $s.ws.cachedHeaderParamsType on param type change
            if (paramObj.in === $s.ws.paramType.HEADER.toLowerCase()) {
                $s.ws.cachedHeaderParamsType[paramObj.name] = paramObj.type;
            }

            // update the test value of param if it's type is changed a to server side property like Current Date, Time, Timestamp and DateTime
            if (['DATE', 'TIME', 'DATETIME', 'TIMESTAMP'].indexOf(paramObj.format) != -1) {
                testValue = getCurrentValuesForServerSideProps(paramObj);
                if (paramObj.in === $s.ws.paramType.HEADER.toLowerCase()) {
                    $s.ws.restInfoHeaders[paramObj.name] = testValue;
                } else if (paramObj.in === $s.ws.paramType.QUERY.toLowerCase()) {
                    $s.ws.restInfoQuery[paramObj.name] = testValue;
                }
                editParamterValueInURL(paramObj, $s.ws.restInfoQuery[paramObj.name]);
            }

            // disables the useProxy flag if the param (Header or Query) is configured as a Server Side property or App Environment property
            disableUseProxyBasedOnParamType(false);
        }

        /**
         * Change the type of new header or query param  and set their respective invalidParamType flag to false
         */
        function onNewParamTypeChange(paramObj) {
            paramObj.type = paramObj.format;
            if (paramObj.in === $s.ws.paramType.HEADER.toLowerCase()) {
                $s.ws.isInvalidHeaderParamType = false;
            }
            if (paramObj.in === $s.ws.paramType.QUERY.toLowerCase()) {
                $s.ws.isInvalidQueryParamType = false;
            }

            // update the test value of param if it's type is changed a to server side property like Current Date, Time, Timestamp and DateTime
            if (['DATE', 'TIME', 'DATETIME', 'TIMESTAMP'].indexOf(paramObj.format) != -1) {
                paramObj.value = getCurrentValuesForServerSideProps(paramObj);
            }
        }

        /**
         *  function to change param type based on x-WM-VARIABLE_TYPE
         *  x-WM-VARIABLE_TYPE === 'SERVER' or 'APP_ENVIRONMENT' => sets param type and format to paramObj['x-WM-VARIABLE_KEY']
         */
        function setParamTypeBasedOnVariableType() {
            _.forEach($s.ws.inputParams, function (paramObj) {
                if (paramObj[VARIABLE_TYPE] === SERVER) {
                    paramObj.type = paramObj.format = paramObj[VARIABLE_KEY];
                    if (paramObj[VARIABLE_KEY] === 'DATE_TIME') {
                        paramObj.type = paramObj.format = 'DATETIME';
                    }
                } else if (paramObj[VARIABLE_TYPE] === APP_ENVIRONMENT) {
                    paramObj.type = paramObj.format = VARIABLE_APP_ENV + paramObj[VARIABLE_KEY];
                }
            });
        }
        /**
         *
         */
        function addCustomContentType() {
            if ($s.ws.customContentType) {
                $s.ws.contentTypeList.push($s.ws.customContentType);
                $s.ws.contentType = $s.ws.customContentType;
                $s.ws.customContentType = '';
                $s.ws.onContentTypeChange();
            }
            $s.ws.showCustomContentTypeField = false;
        }

        // update the disable property of server side properties in paramDataTypes
        function updateDisablePropertyOfParamType() {
            _.forEach($s.ws.paramDataTypes, function (paramObj) {
                if (paramObj.group === $rs.locale.LABEL_SERVER_SIDE_PROPERTIES || paramObj.group === $rs.locale.LABEL_PROPERTY_APPENVPROPERTY) {
                    paramObj.disable = $s.ws.isOptionDisabled;
                }
            });
        }

        /* set watch on the input params to update the parameterized url accordingly */
        listeners.push($s.$watchCollection('ws.inputParams', function (nv) {
            if (nv && $s.ws.restInfoQuery) {
                setParameterizedUrl(nv, $s.ws.activeServiceType ? 'websocket' : 'rest');
            }
        }));

        listeners.push($s.$watch('webServicePropertyChanged', function (newVal) {
            if (newVal) {
                $s.ws.serviceTested = false;
            }
        }));

        // If useProxy if true then disable all server side properties for a param type else enable them
        listeners.push($s.$watch('ws.useProxy', function (nv) {
            if (nv) {
                $s.ws.isOptionDisabled = false;
            } else {
                $s.ws.isOptionDisabled = true;
            }
            updateDisablePropertyOfParamType();
        }));

        // If new header param name is empty then set the isInvalidHeaderParamType to false
        listeners.push($s.$watch('ws.newHeaderParam.name', function (nv) {
            if (nv === '') {
                $s.ws.isInvalidHeaderParamType = false;
            }
        }));

        // If new query param name is empty then set the isInvalidQueryParamType to false
        listeners.push($s.$watch('ws.newQueryParam.name', function (nv) {
            if (nv === '') {
                $s.ws.isInvalidQueryParamType = false;
            }
        }));
        $s.addCustomContentType = addCustomContentType;
        $s.webServiceCtrl.importService = importRestService;
        $s.webServiceCtrl.configureService = importRestService;

        $s.ws.paramType = {
            'QUERY': 'QUERY',
            'HEADER': 'HEADER',
            'PATH': 'PATH',
            'BODY': 'BODY',
            'AUTH': 'AUTH',
            'OTHER': 'OTHER',
            'FORMDATA': 'formData'
        };
        $s.ws.contentTypeMap = {
            'APPLICATION_JSON': 'application/json',
            'APPLICATION_PDF': 'application/pdf',
            'APPLICATION_OCTECT_STREAM': 'application/octet-stream',
            'APPLICATION_XML': 'application/xml',
            'APPLICATION_WWW_FORM_URL_ENCODED': 'application/x-www-form-urlencoded',
            'MULTIPART_FORM_DATA': 'multipart/form-data',
            'TEXT_HTML': 'text/html',
            'TEXT_PLAIN': 'text/plain',
            'TEXT_XML': 'text/xml'
        };
        $s.ws.WS_CONSTANTS = WS_CONSTANTS;
        $s.ws.multipartParamTypes = {
            'file': { 'label': 'File', 'type': 'file', 'list': true },
            'string': { 'label': 'Text', 'type': 'string', 'list': false },
            'text/plain': { 'label': 'Text (text/plain)', 'type': 'string', 'list': false },
            'application/json': { 'label': 'JSON (application/json)', 'type': 'string', 'list': false }
        };
        $s.ws.webServiceTabs = [
            { name: 'Authorization', id: 'authorization' },
            { name: 'Headers', id: 'headers' },
            { name: 'Body', id: 'body' },
            { name: 'Query Params', id: 'query' },
            { name: 'Path Params', id: 'path' }
        ];
        $s.ws.webSocketServiceTabs = [
            { name: 'Body', id: 'body' },
            { name: 'Query Params', id: 'query' },
            { name: 'Path Params', id: 'path' }
        ];
        $s.ws.getNewMultipartParam = function () {
            var newParam = {
                'type': 'file',
                'value': '',
                'list': true
            };
            newParam[PARAMETER_TYPE_KEY] = $s.ws.paramType.FORMDATA;
            newParam[CONTENT_TYPE_KEY] = 'file';
            return newParam;
        };
        $s.ws.serviceName = '';
        $s.ws.operationName = '';
        $s.ws.restSettingOption = 'manual';
        $s.ws.restURL = 'http://maps.googleapis.com/maps/api/directions/xml?origin=Toronto&destination=Montreal&sensor=false';
        $s.ws.restInfoHeaders = {};
        $s.ws.restInfoMultipart = {};
        $s.ws.restInfoPaths = null;
        $s.ws.errorMsgClass = 'false';

        $s.ws.restServiceSteps = ['LABEL_TEST_SERVICE', 'LABEL_CONFIGURE_SERVICE'];
        $s.ws.numRestServiceSteps = $s.ws.restServiceSteps.length;
        $s.ws.serviceTested = false;
        $s.ws.isUrlTested = false;
        $s.ws.isUrlChanged = false;
        $s.ws.serviceMethodList = WS_CONSTANTS.HTTP_METHODS;
        $s.ws.serviceMethod = $s.ws.serviceMethodList[0];
        $s.ws.nonBodyMethods = WS_CONSTANTS.NON_BODY_HTTP_METHODS;
        $s.ws.isNonBodyMethodSelected = true;

        $s.ws.contentTypeList = _.map($s.ws.contentTypeMap, _.identity);
        $s.ws.contentType = $s.ws.contentTypeList[0];
        $s.ws.contentTypeKey = _.keys($s.ws.contentTypeMap)[0];

        $s.ws.requestBody = '';

        $s.ws.advancedSettings = false;
        $s.ws.basicAuthRequired = false;
        $s.ws.userName = '';
        $s.ws.password = '';
        $s.ws.headers = {};
        $s.ws.cachedHeaderParamsType = {};
        $s.ws.multipartParams = [];
        $s.ws.newHeader = { name: '', value: '' };
        $s.ws.newMultipartParam = $s.ws.getNewMultipartParam();
        $s.ws.paramDataTypeGroups = [$rs.locale.LABEL_PROPERTY_UI_TYPE];
        $s.ws.paramDataTypes = [
            {
                uiType: 'Boolean',
                type: SERVICE_TYPES.BOOLEAN,
                format: SERVICE_TYPES.BOOLEAN,
                disable: false,
                group: $rs.locale.LABEL_PROPERTY_UI_TYPE
            },
            {
                uiType: 'Date',
                type: SERVICE_TYPES.STRING,
                format: SERVICE_TYPES.DATE,
                disable: false,
                group: $rs.locale.LABEL_PROPERTY_UI_TYPE
            },
            {
                uiType: 'DateTime',
                type: SERVICE_TYPES.STRING,
                format: SERVICE_TYPES.DATE_TIME,
                disable: false,
                group: $rs.locale.LABEL_PROPERTY_UI_TYPE
            },
            {
                uiType: 'Double',
                type: SERVICE_TYPES.NUMBER,
                format: SERVICE_TYPES.DOUBLE,
                disable: false,
                group: $rs.locale.LABEL_PROPERTY_UI_TYPE
            },
            {
                uiType: 'Float',
                type: SERVICE_TYPES.NUMBER,
                format: SERVICE_TYPES.FLOAT,
                disable: false,
                group: $rs.locale.LABEL_PROPERTY_UI_TYPE
            },
            {
                uiType: 'Integer',
                type: SERVICE_TYPES.INTEGER,
                format: 'int32',
                disable: false,
                group: $rs.locale.LABEL_PROPERTY_UI_TYPE
            },
            {
                uiType: 'Long',
                type: SERVICE_TYPES.INTEGER,
                format: 'int64',
                disable: false,
                group: $rs.locale.LABEL_PROPERTY_UI_TYPE
            },
            {
                uiType: 'String',
                type: SERVICE_TYPES.STRING,
                format: SERVICE_TYPES.STRING,
                disable: false,
                group: $rs.locale.LABEL_PROPERTY_UI_TYPE
            }];

        $s.ws.authenticationType = AUTH_TYPE_NONE;
        $s.ws.newQueryParam = { name: '' };
        $s.ws.newQueryParam[PARAMETER_TYPE_KEY] = $s.ws.paramType.QUERY.toLowerCase();
        $s.ws.newQueryParam[TYPE_KEY] = SERVICE_TYPES.STRING;
        $s.ws.newHeaderParam = { name: '' };
        $s.ws.newHeaderParam[PARAMETER_TYPE_KEY] = $s.ws.paramType.HEADER.toLowerCase();
        $s.ws.newHeaderParam[TYPE_KEY] = SERVICE_TYPES.STRING;
        $s.ws.newPathParam = { name: '' };
        $s.ws.newPathParam[PARAMETER_TYPE_KEY] = $s.ws.paramType.PATH.toLowerCase();
        $s.ws.newPathParam[TYPE_KEY] = SERVICE_TYPES.STRING;
        $s.ws.newMultipartParam = $s.ws.getNewMultipartParam();
        $s.ws.xmlOutputOption = 'schema';
        $s.ws.xmlSchemaOption = 'manual';
        $s.ws.outputTypes = ['none'];
        $s.ws.outputType = $s.ws.outputTypes[0];
        $s.ws.xmlSchemaFilePath = null;
        $s.ws.useProxy = !$rs.isMobileApplicationType;
        $s.ws.disableUseProxy = false;
        $s.ws.isOptionDisabled = true;
        $s.ws.isInvalidQueryParamType = false;
        $s.ws.isInvalidHeaderParamType = false;
        $s.ws.hasAppEnvProperties = _.keys($rs.appEnvironmentProperties).length;
        //Used to hide/show table in params tab
        $s.filteredPathParams = [];
        $s.filteredHeaderParams = [];
        $s.filteredQueryParams = [];

        $s.ws.sampleHttpResponseDetails = {};

        $s.onHttpMethodChange = onHttpMethodChange;
        $s.toggleAuthParams = toggleAuthParams;
        $s.testRestService = testRestService;
        $s.configureService = importRestService;
        $s.decrementStep = decrementStep;
        $s.handleUrlChange = handleUrlChange;
        $s.setParameterizedUrl = setParameterizedUrl;
        $s.getParameterizedUrl = getParameterizedUrl;
        $s.processServiceSettings = processServiceSettings;
        $s.processRequestBodyForImport = processRequestBodyForImport;
        $s.addParam = addParam;
        $s.removeParam = removeParam;
        $s.clearParams = clearParams;
        $s.toggleUseProxy = toggleUseProxy;
        $s.showParamGroup = showParamGroup;

        $s.getServiceDetails = getServiceDetails;
        $s.updateRestService = updateRestService;

        $s.configureTeamApiImport = configureTeamApiImport;
        $s.getUrlWithParamValues = getUrlWithParamValues;
        $s.extractType = Utils.extractType;

        $s.onProviderChange = onProviderChange;
        $s.editProvider = openOAuthConfigDialog;
        $s.editParamterValueInURL = editParamterValueInURL;
        $s.openOAuthSelectionDialog = openOAuthSelectionDialog;
        $s.onParamTypeChange = onParamTypeChange;
        $s.onNewParamTypeChange = onNewParamTypeChange;
        $s.checkIfParamTypeExists = checkIfAppEnvPropertyExists;
        $s.setTitleMessage = setTitleMessage;

        listeners.push($rs.$on('wms:app-env-properties-update', function () {
            updateAppEnvParamTypes($s.ws.paramDataTypes, true);
        }));
        $s.$on('$destroy', function () {
            _.forEach(listeners, Utils.triggerFn);
        });

        //during initialization of project we do not have editMode set to true, so rely on dialog conditions
        if ($s.activeWebServiceType === $s.ws.serviceType.REST) {
            loadoAuthProviders();
            // showing server side properties only for REST services
            if ($s.ws.paramDataTypeGroups.length === 1) {
                $s.ws.paramDataTypeGroups.push($rs.locale.LABEL_SERVER_SIDE_PROPERTIES);
                $s.ws.paramDataTypeGroups.push($rs.locale.LABEL_PROPERTY_APPENVPROPERTY);
            }
            //Initializing App Env properties and Server Side properties for query params and header params
            toggleUseProxy();
        }
        handleUrlChange('', true);
    }
];