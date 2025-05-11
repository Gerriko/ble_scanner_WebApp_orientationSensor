/** @type {HTMLButtonElement | null} */
const scanButton = document.getElementById('scanButton');
/** @type {HTMLButtonElement | null} */
const disconnectButton = document.getElementById('disconnectButton');
/** @type {HTMLUListElement | null} */
const deviceListElement = document.getElementById('deviceList');
/** @type {HTMLUListElement | null} */
const characteristicListElement = document.getElementById('characteristicList');
/** @type {HTMLDivElement | null} */
const statusElement = document.getElementById('status');
/** @type {HTMLDivElement | null} */
const errorElement = document.getElementById('error');
/** @type {HTMLSpanElement | null} */
const targetServiceUUIDDisplay = document.getElementById('targetServiceUUIDDisplay');
/** @type {HTMLDivElement | null} */
const connectionInfoElement = document.getElementById('connectionInfo');
/** @type {HTMLSpanElement | null} */
const connectedDeviceNameElement = document.getElementById('connectedDeviceName');
/** @type {HTMLSpanElement | null} */
const connectedServiceUUIDElement = document.getElementById('connectedServiceUUID');

// 3D Model Elements
/** @type {HTMLDivElement | null} */
const threeDVisualizationDiv = document.getElementById('threeDVisualization');
/** @type {HTMLButtonElement | null} */
const show3DModelButton = document.getElementById('show3DModelButton');
/** @type {HTMLDivElement | null} */
const threeDCanvasContainer = document.getElementById('threeDCanvasContainer');
/** @type {HTMLDivElement | null} */
const threeDControlsDiv = document.getElementById('threeDControls');
/** @type {HTMLInputElement | null} */
const rollInput = document.getElementById('roll');
/** @type {HTMLInputElement | null} */
const pitchInput = document.getElementById('pitch');
/** @type {HTMLInputElement | null} */
const yawInput = document.getElementById('yaw');
/** @type {HTMLSpanElement | null} */
const rollValueSpan = document.getElementById('rollValue');
/** @type {HTMLSpanElement | null} */
const pitchValueSpan = document.getElementById('pitchValue');
/** @type {HTMLSpanElement | null} */
const yawValueSpan = document.getElementById('yawValue');

/** @type {?THREE.Scene} */
/** Three.js scene object. */
let scene, camera, renderer, cube;

// New elements for BLE data display
/** @type {HTMLDivElement | null} */
const bleDataDisplayDiv = document.getElementById('bleDataDisplay');
/** @type {HTMLTableSectionElement | null} */
const bleDataTableBody = document.getElementById('bleDataTable').getElementsByTagName('tbody')[0];
/** @type {HTMLDivElement | null} */
const notificationTogglesDiv = document.getElementById('notificationToggles');
/** @type {HTMLDivElement | null} */
const descriptorInfoOutputDiv = document.getElementById('descriptorInfoOutput');

/** @type {?THREE.OrbitControls} */
/** Three.js OrbitControls object. */
let controls; // For OrbitControls

// ----------------------------------------------------------------------------------
// IMPORTANT: REPLACE THIS WITH YOUR ACTUAL 128-BIT SERVICE UUID
/**
 * The target 128-bit Service UUID to scan for.
 * @const {string}
 */
const TARGET_SERVICE_UUID = '19B10010-E8F2-537E-4F6C-D104768A1214'.toLowerCase(); // e.g., 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
/**
 * The target Characteristic UUID for Pitch data.
 * @const {string}
 */
const TARGET_CHARACTERISTIC_PITCH_UUID = '19B10013-E8F2-537E-4F6C-D104768A1214'.toLowerCase();
/**
 * The target Characteristic UUID for Roll data.
 * @const {string}
 */
const TARGET_CHARACTERISTIC_ROLL_UUID = '19B10014-E8F2-537E-4F6C-D104768A1214'.toLowerCase();
/**
 * The target Characteristic UUID for compensated Heading data.
 * @const {string}
 */
const TARGET_CHARACTERISTIC_HEADINGCOMP_UUID = '19B10016-E8F2-537E-4F6C-D104768A1214'.toLowerCase();
// ----------------------------------------------------------------------------------

if (targetServiceUUIDDisplay) {
    targetServiceUUIDDisplay.textContent = TARGET_SERVICE_UUID;
}

/**
 * Map to store discovered BluetoothDevice objects by their ID.
 * @type {Map<string, BluetoothDevice>}
 */
let discoveredDevices = new Map();
/** @type {?BluetoothDevice} */
/** The currently connected Bluetooth device. */
let connectedDevice = null;
/** @type {?BluetoothRemoteGATTServer} */
/** The GATT server of the connected device. */
let gattServer = null;
/** @type {?BluetoothRemoteGATTCharacteristic} */
/** The Pitch characteristic object. */
let pitchCharacteristic = null;
/** @type {?BluetoothRemoteGATTCharacteristic} */
/** The Roll characteristic object. */
let rollCharacteristic = null;
/** @type {?BluetoothRemoteGATTCharacteristic} */
/** The Heading characteristic object. */
let headingCharacteristic = null;

/**
 * @typedef {Object} CharacteristicDataStoreEntry
 * @property {?ParsedPresentationFormat} descriptor - Parsed 0x2904 descriptor data.
 * @property {string|number|ArrayBuffer|BigInt} rawValue - The raw value from the characteristic.
 * @property {string|number} formattedValue - The value after applying exponent and formatting.
 * @property {string} unit - The unit symbol from the descriptor.
 * @property {string} timestamp - Timestamp of the last update.
 * @property {boolean} isNotifying - Whether notifications are active for this characteristic.
 * @property {?BluetoothRemoteGATTCharacteristic} characteristicObject - The actual characteristic object.
 * @property {string} name - A human-readable name for the characteristic.
 */
/**
 * Stores data and state for characteristics.
 * Keyed by characteristic UUID.
 * @type {Object<string, CharacteristicDataStoreEntry>}
 */
let characteristicDataStore = {}; // Stores { uuid: { descriptor: {}, value: ..., timestamp: ..., isNotifying: false, characteristicObject: char }}

// --- Maps for 0x2904 parsing ---
/**
 * @typedef {Object} GattFormatType
 * @property {string} name - Human-readable name of the format.
 * @property {function(DataView, number, boolean=, number=): (number|string|boolean|BigInt)} read - Function to read the value.
 * @property {number} bytes - Number of bytes for this format (NaN if variable).
 */
/**
 * Lookup table for GATT characteristic format types (Bluetooth SIG Assigned Numbers).
 * @see {@link https://www.bluetooth.com/specifications/assigned-numbers/format-types/}
 * @const {Object<number, GattFormatType>}
 */
const GATT_FORMAT_TYPES = { // Only a subset, add more as needed
    0x01: { name: "boolean", read: (dv, o, le) => dv.getUint8(o) !== 0, bytes: 1 },
    0x04: { name: "uint8", read: (dv, o, le) => dv.getUint8(o), bytes: 1 },
    0x06: { name: "uint16", read: (dv, o, le=true) => dv.getUint16(o, le), bytes: 2 },
    0x08: { name: "uint32", read: (dv, o, le=true) => dv.getUint32(o, le), bytes: 4 },
    0x10: { name: "sint8", read: (dv, o, le) => dv.getInt8(o), bytes: 1 },
    0x12: { name: "sint16", read: (dv, o, le=true) => dv.getInt16(o, le), bytes: 2 },
    0x14: { name: "IEEE-754 32-bit float", read: (dv, o, le=true) => dv.getInt32(o, le), bytes: 4 },
    0x1B: { name: "float32", read: (dv, o, le=true) => dv.getFloat32(o, le), bytes: 4 },
    0x1C: { name: "float64", read: (dv, o, le=true) => dv.getFloat64(o, le), bytes: 8 },
    0x19: { name: "utf8s", read: (dv, o, le, len) => new TextDecoder().decode(dv.buffer.slice(dv.byteOffset + o, dv.byteOffset + o + len)), bytes: NaN}, // Length dependent
};

/**
 * @typedef {Object} GattUnit
 * @property {string} symbol - Unit symbol (e.g., "°C").
 * @property {string} name - Full name of the unit (e.g., "temperature (Celsius)").
 */
/**
 * Lookup table for GATT units based on Bluetooth SIG Assigned Numbers.
 * @see {@link https://www.bluetooth.com/specifications/assigned-numbers/units/}
 * @const {Object<number, GattUnit>}
 */
const GATT_UNITS = { // See Bluetooth SIG Assigned Numbers for Units
    0x2700: { symbol: "", name: "unitless" },
    0x2701: { symbol: "m", name: "length (metre)" },
    0x2703: { symbol: "s", name: "time (second)" },
    0x272F: { symbol: "°C", name: "temperature (Celsius)" },
    0x2763: { symbol: "°", name: "plane angle (degree)" },
    0x27AD: { symbol: "%", name: "percentage" },
    // Add more as needed, e.g., for angular velocity, magnetic flux, etc.
    // For example, if your device uses a specific unit for heading/pitch/roll not in degrees:
    // 0xXXXX: { symbol: "custom", name: "custom unit" }
};

/**
 * Lookup table for GATT namespace descriptions (Bluetooth SIG Assigned Numbers).
 * @see {@link https://www.bluetooth.com/specifications/assigned-numbers/gatt-namespace-descriptors/}
 * @const {Object<number, string>}
 */
const GATT_NAMESPACE_DESCRIPTIONS = {
    0x00: "Unknown",
    0x01: "Bluetooth SIG Assigned Numbers"
};

/**
 * Retrieves GATT format information for a given format code.
 * @param {number} formatCode - The format code.
 * @returns {GattFormatType} The format information object. Defaults to an unknown format if not found.
 */
function getGattFormat(formatCode) {
    return GATT_FORMAT_TYPES[formatCode] || { name: `Unknown format (0x${formatCode.toString(16)})`, read: () => "N/A (Unknown Format)", bytes: 0 };
}

/**
 * Retrieves GATT unit information for a given unit code.
 * @param {number} unitCode - The unit code (UUID).
 * @returns {GattUnit} The unit information object. Defaults to an unknown unit if not found.
 */
function getGattUnit(unitCode) {
    return GATT_UNITS[unitCode] || { symbol: `UUID 0x${unitCode.toString(16)}`, name: "Unknown Unit" };
}

/**
 * @typedef {Object} ParsedPresentationFormat
 * @property {number} format - The format code.
 * @property {string} formatName - Human-readable name of the format.
 * @property {function(DataView, number, boolean=, number=): (number|string|boolean|BigInt)} formatReader - Function to read the value.
 * @property {number} formatBytes - Number of bytes for this format.
 * @property {number} exponent - The exponent value.
 * @property {number} unitUUID - The unit UUID.
 * @property {string} unitSymbol - The unit symbol.
 * @property {string} unitName - The full name of the unit.
 * @property {number} namespace - The namespace code.
 * @property {string} namespaceName - The name of the namespace.
 * @property {number} description - The description field value.
 * @property {string} [error] - Error message if parsing failed.
 */
/**
 * Parses the Characteristic Presentation Format (0x2904) descriptor value.
 * @param {DataView} dataView - The DataView containing the descriptor value.
 * @param {string} [charNameForLog="characteristic"] - Name of the characteristic for logging purposes.
 * @returns {ParsedPresentationFormat} Parsed descriptor information or an object with an error property.
 */
function parseCharacteristicPresentationFormat(dataView, charNameForLog) {
    charNameForLog = charNameForLog || 'characteristic'; // Default value if not provided
    if (dataView.byteLength < 7) {
        logError(`0x2904 data too short for ${charNameForLog}. Length: ${dataView.byteLength}`);
        return { error: "Data too short" };
    }
    const format = dataView.getUint8(0);
    const exponent = dataView.getInt8(1);
    const unitUUID = dataView.getUint16(2, true); // true for little-endian
    const namespace = dataView.getUint8(4);
    const description = dataView.getUint16(5, true); // true for little-endian

    const formatInfo = getGattFormat(format);
    const unitInfo = getGattUnit(unitUUID);

    return { format, formatName: formatInfo.name, formatReader: formatInfo.read, formatBytes: formatInfo.bytes, exponent, unitUUID, unitSymbol: unitInfo.symbol, unitName: unitInfo.name, namespace, namespaceName: GATT_NAMESPACE_DESCRIPTIONS[namespace] || "Unknown Namespace", description };
}

/**
 * Logs a status message to the console and updates the status UI element.
 * @param {string} message - The status message.
 */
function logStatus(message) {
    console.log(message);
    if (statusElement) statusElement.textContent = `Status: ${message}`;
    if (errorElement) errorElement.style.display = 'none';
}

/**
 * Logs an error message to the console and updates the error UI element.
 * @param {string} message - The error message.
 * @param {Error} [error] - The associated Error object, if any.
 */
function logError(message, error) {
    console.error(message, error);
    if (statusElement) statusElement.textContent = `Status: Error`;
    if (errorElement) {
        errorElement.textContent = `${message}${error ? ': ' + error.message : ''}`;
        errorElement.style.display = 'block';
    }
}

// Initial check for TARGET_SERVICE_UUID configuration
if (TARGET_SERVICE_UUID === '00000000-0000-0000-0000-000000000000') {
    logError("Configuration needed: Please update the TARGET_SERVICE_UUID in the script.");
    if (scanButton) scanButton.disabled = true;
    hide3DVisualization();
}


/**
 * Handles the click event for the scan button.
 * Initiates a Bluetooth device scan for the TARGET_SERVICE_UUID.
 */
async function handleScanButtonClick() {
    if (!navigator.bluetooth) {
        logError('Web Bluetooth API is not available in this browser.');
        return;
    }
    if (TARGET_SERVICE_UUID === '00000000-0000-0000-0000-000000000000') {
        logError("Configuration Error: Please set the TARGET_SERVICE_UUID in the script.");
        return;
    }

    try {
        logStatus('Requesting Bluetooth devices...');
        if (deviceListElement) deviceListElement.innerHTML = ''; // Clear previous list
        if (characteristicListElement) characteristicListElement.innerHTML = '';
        if (connectionInfoElement) connectionInfoElement.style.display = 'none'; // Hide connection info
        if (disconnectButton) {
            disconnectButton.style.display = 'none'; // Hide disconnect button
            if (scanButton) scanButton.disabled = false; // Ensure scan button is enabled
        }
        hide3DVisualization();
        discoveredDevices.clear();

        const device = await navigator.bluetooth.requestDevice({
            filters: [{
                services: [TARGET_SERVICE_UUID]
            }],
            // acceptAllDevices: false, // Set to true if you want to scan and then filter manually (less efficient)
        });

        logStatus(`Device found: ${device.name || `ID: ${device.id}`}`);
        addDeviceToList(device);

    } catch (error) {
        if (error.name === 'NotFoundError') {
            logStatus('Scan cancelled or no devices found matching the filter.');
        } else {
            logError('Error requesting device', error);
        }
    }
}

if (scanButton) {
    scanButton.addEventListener('click', handleScanButtonClick);
}

/**
 * Adds a discovered device to the UI list and stores it in `discoveredDevices` map.
 * @param {BluetoothDevice} device - The discovered Bluetooth device.
 */
function addDeviceToList(device) {
    discoveredDevices.set(device.id, device); // Store the device object

    const listItem = document.createElement('li');
    listItem.classList.add('device-item');
    listItem.textContent = `${device.name || `ID: ${device.id}`}`;
    listItem.dataset.deviceId = device.id; // Store device ID for click handling
    listItem.addEventListener('click', handleDeviceSelection);
    if (deviceListElement) deviceListElement.appendChild(listItem);
}

/**
 * Handles the selection of a device from the list.
 * Connects to the selected device and retrieves its services and characteristics.
 * @param {Event} event - The click event from the device list item.
 * @async
 */
async function handleDeviceSelection(event) {
    const deviceId = event.currentTarget.dataset.deviceId;
    const device = discoveredDevices.get(deviceId);

    if (!device) {
        logError('Selected device not found in memory.');
        return;
    }

    logStatus(`Connecting to ${device.name || `ID: ${device.id}`}...`);
    if (scanButton) scanButton.disabled = true;
    if (characteristicListElement) characteristicListElement.innerHTML = ''; // Clear previous characteristics

    try {
        // Reset previously connected characteristic objects
        pitchCharacteristic = null;
        rollCharacteristic = null;
        headingCharacteristic = null;

        if (gattServer && gattServer.connected) {
            logStatus('Already connected to a device. Disconnecting first...');
            await gattServer.disconnect();
        }

        gattServer = await device.gatt.connect();
        connectedDevice = device;
        device.addEventListener('gattserverdisconnected', onDisconnected); // Listen for unexpected disconnects
        logStatus(`Connected to ${device.name || `ID: ${device.id}`}`);

        if (connectedDeviceNameElement) connectedDeviceNameElement.textContent = device.name || `ID: ${device.id}`;
        if (connectedServiceUUIDElement) connectedServiceUUIDElement.textContent = TARGET_SERVICE_UUID;
        if (connectionInfoElement) connectionInfoElement.style.display = 'block';
        if (disconnectButton) {
            disconnectButton.style.display = 'inline-block';
            // scanButton is already disabled from the start of this function,
            // and the finally block will ensure its state is correct based on disconnectButton.
        }

        logStatus(`Getting service: ${TARGET_SERVICE_UUID}...`);
        const service = await gattServer.getPrimaryService(TARGET_SERVICE_UUID);
        logStatus('Service found. Getting characteristics...');

        const characteristics = await service.getCharacteristics();
        if (characteristics.length === 0) {
            logStatus('No characteristics found for this service.');
            const listItem = document.createElement('li');
            listItem.textContent = 'No characteristics found for this service.';
            characteristicListElement.appendChild(listItem);
        } else {
            logStatus(`Found ${characteristics.length} characteristic(s):`);
            characteristics.forEach(characteristic => {
                const listItem = document.createElement('li');
                let charProperties = [];
                if (characteristic.properties.read) charProperties.push('READ');
                if (characteristic.properties.write) charProperties.push('WRITE');
                if (characteristic.properties.writeWithoutResponse) charProperties.push('WRITE_NO_RESPONSE');
                if (characteristic.properties.notify) charProperties.push('NOTIFY');
                if (characteristic.properties.indicate) charProperties.push('INDICATE');

                listItem.textContent = `UUID: ${characteristic.uuid} (Properties: ${charProperties.join(', ')})`;
                if (characteristicListElement) characteristicListElement.appendChild(listItem);
                console.log('Characteristic:', characteristic);

                if (characteristic.uuid === TARGET_CHARACTERISTIC_PITCH_UUID) pitchCharacteristic = characteristic;
                if (characteristic.uuid === TARGET_CHARACTERISTIC_ROLL_UUID) rollCharacteristic = characteristic;
                if (characteristic.uuid === TARGET_CHARACTERISTIC_HEADINGCOMP_UUID) headingCharacteristic = characteristic;
            });

            // Check for specific characteristics required for 3D model
            const hasPitchChar = characteristics.some(char => char.uuid === TARGET_CHARACTERISTIC_PITCH_UUID);
            const hasRollChar = characteristics.some(char => char.uuid === TARGET_CHARACTERISTIC_ROLL_UUID);
            const hasHeadingChar = characteristics.some(char => char.uuid === TARGET_CHARACTERISTIC_HEADINGCOMP_UUID);

            if (hasPitchChar && hasRollChar && hasHeadingChar) { // Simplified: just require the 3 key ones
                logStatus(`Found ${characteristics.length} characteristics, including the required PITCH, ROLL, and HEADING UUID's. Enabling 3D model to visualise data.`);
                if (threeDVisualizationDiv) threeDVisualizationDiv.style.display = 'block';
                if (show3DModelButton) show3DModelButton.style.display = 'inline-block';
                if (threeDCanvasContainer) threeDCanvasContainer.style.display = 'none'; // Keep canvas hidden until button click
                if (threeDControlsDiv) threeDControlsDiv.style.display = 'none';    // Keep controls hidden until button click
            } else if (characteristics.length >= 5) {
                logStatus(`Found ${characteristics.length} characteristics, but not all required for 3D model (PITCH, ROLL, HEADING). 3D model view disabled.`);
                hide3DVisualization(true); // Pass true to indicate it's not a full disconnect
            } else {
                logStatus(`Found ${characteristics.length} characteristics. Not enough or missing required characteristics for 3D model view.`);
                hide3DVisualization();
            }
        }
    } catch (error) {
        logError(`Error connecting or getting service/characteristics`, error);
        if (gattServer && gattServer.connected) {
            gattServer.disconnect();
        }
        gattServer = null;
        connectedDevice = null;
        if (connectionInfoElement) connectionInfoElement.style.display = 'none';
        if (disconnectButton) {
            disconnectButton.style.display = 'none';
            // scanButton state will be handled by the finally block.
        }
        hide3DVisualization();
    } finally {
        // Ensure scanButton's state is correctly set based on disconnectButton's visibility
        if (scanButton && disconnectButton) {
            if (disconnectButton.style.display !== 'none') {
                scanButton.disabled = true; // Connected, so disable scanning
            } else {
                scanButton.disabled = false; // Not connected, so enable scanning
            }
        } else if (scanButton) {
            scanButton.disabled = false; // Fallback if disconnectButton is not found
        }
    }
}

/**
 * Fully disconnects from the current device and cleans up related state and UI.
 * Stops all active notifications.
 * @async
 */
async function fullDisconnectAndCleanup() {
    logStatus('Attempting to disconnect and clean up...');
    if (gattServer && gattServer.connected) {
        logStatus('Disconnecting...');
        // Stop notifications for all characteristics we might be listening to
        for (const uuid in characteristicDataStore) {
            const data = characteristicDataStore[uuid];
            if (data.isNotifying && data.characteristicObject) {
                try {
                    await data.characteristicObject.stopNotifications();
                    data.characteristicObject.removeEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);
                    data.isNotifying = false; // Update state
                    logStatus(`Stopped notifications for ${uuid}`);
                } catch (e) {
                    logError(`Error stopping notifications for ${uuid} on disconnect`, e);
                }
            }
        }
        gattServer.disconnect();
        logStatus('Disconnected.');
    } else if (!gattServer) {
        logStatus('Not connected.');
    } else {
        logStatus('GATT server exists but is not connected. Proceeding with cleanup.');
    }
    gattServer = null;
    connectedDevice = null;
    if (connectionInfoElement) connectionInfoElement.style.display = 'none';
    if (characteristicListElement) characteristicListElement.innerHTML = '';
    if (deviceListElement) deviceListElement.innerHTML = ''; // Clear the found devices list
    if (disconnectButton) disconnectButton.style.display = 'none';
    if (scanButton) scanButton.disabled = false;
    hide3DVisualization();
    characteristicDataStore = {}; // Clear stored data
    logStatus('Cleanup complete. Ready to scan.');
}

/**
 * Handles the click event for the disconnect button.
 * @async
 */
async function handleDisconnectButtonClick() {
    await fullDisconnectAndCleanup();
}

if (disconnectButton) {
    disconnectButton.addEventListener('click', handleDisconnectButtonClick);
}

// Handle device disconnection events (e.g., device goes out of range)
function onDisconnected(event) {
    const device = event.target;
    logStatus(`Device ${device.name || `ID: ${device.id}`} disconnected.`);
    if (connectedDevice && connectedDevice.id === device.id) {
        // Call fullDisconnectAndCleanup, but gattServer might already be disconnected
        // We mainly need to update UI and clear state
        fullDisconnectAndCleanup().catch(e => logError("Error during unexpected disconnect cleanup", e));
    }
}

// --- 3D Model Functions ---
function hide3DVisualization(partialHide = false) {
    threeDVisualizationDiv.style.display = 'none';
    show3DModelButton.style.display = 'none';
    bleDataDisplayDiv.style.display = 'none';
    bleDataTableBody.innerHTML = '';
    notificationTogglesDiv.innerHTML = '';
    descriptorInfoOutputDiv.innerHTML = '';
    threeDCanvasContainer.style.display = 'none';
    if (threeDCanvasContainer.firstChild) { // If canvas exists
        threeDCanvasContainer.innerHTML = ''; // Clear canvas content
    }
    threeDControlsDiv.style.display = 'none';

    if (renderer) {
        renderer.dispose();
        renderer = null;
    }
    scene = null;
    camera = null;
    cube = null;
    if (controls) {
        controls.dispose();
        controls = null;
    }
    window.removeEventListener('resize', resizeRendererToDisplaySize);

    if (!partialHide) { // If it's a full hide (like disconnect), clear characteristic objects
        // When doing a full hide, ensure notification status reflects that none are active
        // if this hide also implies clearing characteristicDataStore.
        const oldStore = { ...characteristicDataStore }; // shallow copy for checking
        pitchCharacteristic = null;
        rollCharacteristic = null;
        headingCharacteristic = null;
        characteristicDataStore = {};
        // If the store was actually cleared, update the status.
        // This prevents "Active Notifications: ..." from lingering if we hide the model.
        if (Object.keys(oldStore).length > 0) {
            updateCombinedNotificationStatus();
        }
    }
}

/**
 * Updates the main status message to show a list of currently notifying characteristics.
 */
function updateCombinedNotificationStatus() {
    const notifyingChars = Object.values(characteristicDataStore)
        .filter(entry => entry.isNotifying && entry.name)
        .map(entry => entry.name);

    if (notifyingChars.length > 0) {
        logStatus(`Active Notifications: ${notifyingChars.join(', ')}`);
    } else {
        // Only state "No active" if the BLE data display is potentially visible.
        // Otherwise, other statuses like "Disconnected" or "Scanning" are more relevant.
        if (bleDataDisplayDiv && bleDataDisplayDiv.style.display !== 'none') {
            logStatus("No active BLE notifications.");
        }
        // If bleDataDisplayDiv is hidden, we don't override other important statuses.
    }
}

/**
 * Handles the click event for the "Show 3D Model" button.
 * Initializes Three.js, displays the 3D canvas and controls,
 * and sets up characteristic interactions.
 * @async
 */
async function handleShow3DModelClick() {
    if (!THREE) {
        logError("Three.js library is not loaded. Cannot show 3D model.");
        return;
    }
    if (threeDCanvasContainer) threeDCanvasContainer.style.display = 'block';
    if (threeDControlsDiv) threeDControlsDiv.style.display = 'block';
    if (bleDataDisplayDiv) bleDataDisplayDiv.style.display = 'block';
    initThreeJS();
    if (show3DModelButton) show3DModelButton.style.display = 'none'; // Hide button after showing model
    await setupCharacteristicInteractions();
}

if (show3DModelButton) {
    show3DModelButton.addEventListener('click', handleShow3DModelClick);
}

/**
 * Sets up interactions with the required BLE characteristics for the 3D model.
 * This includes reading descriptors, starting notifications, and populating UI elements
 * related to characteristic data and controls.
 * @async
 */
async function setupCharacteristicInteractions() {
    const characteristicsToSetup = [
        /** @type {{name: string, charObj: (BluetoothRemoteGATTCharacteristic|null), uuid: string}} */
        { name: "Pitch", charObj: pitchCharacteristic, uuid: TARGET_CHARACTERISTIC_PITCH_UUID },
        /** @type {{name: string, charObj: (BluetoothRemoteGATTCharacteristic|null), uuid: string}} */
        { name: "Roll", charObj: rollCharacteristic, uuid: TARGET_CHARACTERISTIC_ROLL_UUID },
        /** @type {{name: string, charObj: (BluetoothRemoteGATTCharacteristic|null), uuid: string}} */
        { name: "Heading", charObj: headingCharacteristic, uuid: TARGET_CHARACTERISTIC_HEADINGCOMP_UUID }
    ];

    descriptorInfoOutputDiv.innerHTML = ''; // Clear previous
    notificationTogglesDiv.innerHTML = ''; // Clear previous
    bleDataTableBody.innerHTML = ''; // Clear previous table data

    for (const item of characteristicsToSetup) {
        /** @type {CharacteristicDataStoreEntry} */
        characteristicDataStore[item.uuid] = { // Initialize store entry
            descriptor: null,
            rawValue: "N/A",
            formattedValue: "N/A",
            unit: "",
            timestamp: "N/A",
            isNotifying: false,
            characteristicObject: item.charObj,
            name: item.name
        };
        addOrUpdateTableRow(item.uuid, item.name); // Add initial row to table

        if (item.charObj) {
            let descriptorText = `<strong>${item.name} (UUID: ${item.uuid}):</strong>\n`;
            try {
                const descriptor = await item.charObj.getDescriptor('00002904-0000-1000-8000-00805f9b34fb'); // Characteristic Presentation Format
                const value = await descriptor.readValue();
                const parsedDesc = parseCharacteristicPresentationFormat(value, item.name);
                characteristicDataStore[item.uuid].descriptor = parsedDesc;

                descriptorText += `  Format: ${parsedDesc.formatName} (0x${parsedDesc.format.toString(16)})\n`;
                descriptorText += `  Exponent: ${parsedDesc.exponent}\n`;
                descriptorText += `  Unit: ${parsedDesc.unitName} (${parsedDesc.unitSymbol}, UUID: 0x${parsedDesc.unitUUID.toString(16)})\n`;
                descriptorText += `  Namespace: ${parsedDesc.namespaceName} (0x${parsedDesc.namespace.toString(16)})\n`;
                descriptorText += `  Description Field: 0x${parsedDesc.description.toString(16)}\n`;

                await item.charObj.startNotifications();
                item.charObj.addEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);
                characteristicDataStore[item.uuid].isNotifying = true;
                updateCombinedNotificationStatus(); // Update combined status
            } catch (err) {
                logError(`Error setting up ${item.name}`, err);
                descriptorText += `  Error reading 0x2904 or starting notifications: ${err.message}\n`;
                characteristicDataStore[item.uuid].isNotifying = false;
            }            
            if (descriptorInfoOutputDiv) descriptorInfoOutputDiv.innerHTML += descriptorText + "\n";
            createToggleNotificationButton(item.uuid);
        } else {
            if (descriptorInfoOutputDiv) {
                descriptorInfoOutputDiv.innerHTML += `<strong>${item.name} (UUID: ${item.uuid}):</strong> Characteristic not found.\n\n`;
            }
            createToggleNotificationButton(item.uuid, true); // Create disabled button
        }
    }
}

/**
 * Represents the event object for 'characteristicvaluechanged' events,
 * specifically typing the `target` property.
 * @typedef {Event} CharacteristicValueChangedEvent
 * @property {BluetoothRemoteGATTCharacteristic} target - The characteristic that fired the event.
 */
/**
 * Handles incoming data when a characteristic's value changes (due to notifications).
 * @param {CharacteristicValueChangedEvent} event - The `characteristicvaluechanged` event.
 */
function handleCharacteristicValueChanged(event) {
    const characteristic = event.target;
    const uuid = characteristic.uuid;
    const dataView = characteristic.value;
    const now = new Date().toLocaleTimeString();

    const storeEntry = characteristicDataStore[uuid];
    if (!storeEntry) return;

    let rawValue = "N/A";
    let formattedValue = "N/A";
    const desc = storeEntry.descriptor;

    if (desc && desc.formatReader) {
        if (dataView.byteLength >= (desc.formatBytes || 1)) { // Check if enough bytes for format
            try {
                // Get raw value based on descriptor's specified format
                rawValue = desc.formatReader(dataView, 0, true, dataView.byteLength); // true for littleEndian, pass length for strings

                // Special override: if descriptor says sint32 (0x14), interpret data as float32 for formattedValue
                if (desc.format === 0x14) { // GATT_FORMAT_SINT32
                    // We already know dataView.byteLength >= desc.formatBytes (which is 4 for sint32)
                    // Re-interpret the same bytes as float32
                    let floatVal = dataView.getFloat32(0, true); // true for littleEndian
                    formattedValue = floatVal * (10 ** desc.exponent);
                } else {
                    // Standard handling for other types
                    formattedValue = rawValue * (10 ** desc.exponent);
                    if (typeof rawValue === 'bigint') {
                        formattedValue = parseFloat(rawValue.toString()) * (10 ** desc.exponent);
                    }
                    if (typeof rawValue === 'string') { // For utf8s, exponent usually isn't applied or is 0
                        formattedValue = rawValue;
                    }
                }
            } catch (e) {
                logError(`Error parsing value for ${storeEntry.name} (format: ${desc.formatName || 'unknown'}, declared bytes: ${desc.formatBytes}): ${e.message}`);
                rawValue = "Parse Error";
                formattedValue = "Parse Error";
            }
        } else {
            rawValue = `Data too short (got ${dataView.byteLength}, need ${desc.formatBytes || 1})`;
            formattedValue = "N/A";
        }
    } else if (dataView.byteLength > 0) { // No descriptor, try to show as hex
        rawValue = Array.from(new Uint8Array(dataView.buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        formattedValue = "N/A (No descriptor/format)";
    } else { // No data
        rawValue = "No data";
        formattedValue = "N/A";
    }

    storeEntry.rawValue = rawValue;
    storeEntry.formattedValue = formattedValue;
    storeEntry.unit = desc ? desc.unitSymbol : "";
    storeEntry.timestamp = now;
    addOrUpdateTableRow(uuid, storeEntry.name, rawValue, formattedValue, storeEntry.unit, now);

    // Update 3D model sliders and data table
    if (typeof formattedValue === 'number') {
        if (uuid === TARGET_CHARACTERISTIC_PITCH_UUID) {
            if (pitchInput) pitchInput.value = formattedValue.toFixed(2);
            if (pitchValueSpan) pitchValueSpan.textContent = formattedValue.toFixed(2);
        } else if (uuid === TARGET_CHARACTERISTIC_ROLL_UUID) {
            if (rollInput) rollInput.value = formattedValue.toFixed(2);
            if (rollValueSpan) rollValueSpan.textContent = formattedValue.toFixed(2);
        } else if (uuid === TARGET_CHARACTERISTIC_HEADINGCOMP_UUID) {
            let numericYaw = formattedValue;

            if (numericYaw > 180.0) {
                numericYaw -= 360.0;
                console.log("Original yaw (" + formattedValue.toFixed(2) + ") was > 180. Adjusted to: " + numericYaw.toFixed(2));
            }
            if (yawInput) yawInput.value = numericYaw.toFixed(2);
            if (yawValueSpan) yawValueSpan.textContent = numericYaw.toFixed(2);
        }
    }
    if (typeof formattedValue === 'number') updateCubeRotation();
}
/**
 * Adds a new row or updates an existing row in the BLE data table.
 * @param {string} uuid - The UUID of the characteristic.
 * @param {string} name - The name of the characteristic.
 * @param {string|number|ArrayBuffer|BigInt} [raw="N/A"] - The raw data value.
 * @param {string|number} [formatted="N/A"] - The formatted data value.
 * @param {string} [unit=""] - The unit of the data.
 * @param {string} [time="N/A"] - The timestamp of the data.
 */
function addOrUpdateTableRow(uuid, name, raw = "N/A", formatted = "N/A", unit = "", time = "N/A") {
    let row = document.getElementById(`row-${uuid}`);
    if (!row) {
        row = bleDataTableBody.insertRow();
        row.id = `row-${uuid}`;
        row.insertCell().textContent = name; // Characteristic Name
        row.insertCell().id = `rawValue-${uuid}`; // Raw Value
        row.insertCell().id = `formattedValue-${uuid}`; // Formatted Value
        row.insertCell().id = `unit-${uuid}`; // Unit
        row.insertCell().id = `timestamp-${uuid}`; // Timestamp
    }
    document.getElementById(`rawValue-${uuid}`).textContent = typeof raw === 'number' && !Number.isInteger(raw) ? raw.toFixed(4) : raw.toString();
    document.getElementById(`formattedValue-${uuid}`).textContent = typeof formatted === 'number' && !Number.isInteger(formatted) ? formatted.toFixed(4) : formatted.toString();
    document.getElementById(`unit-${uuid}`).textContent = unit;
    document.getElementById(`timestamp-${uuid}`).textContent = time;
}
/**
 * Creates a button to toggle notifications for a given characteristic and appends it to the UI.
 * @param {string} uuid - The UUID of the characteristic.
 * @param {boolean} [disabled=false] - Whether the button should be initially disabled.
 */

function createToggleNotificationButton(uuid, disabled = false) {
    const storeEntry = characteristicDataStore[uuid];
    if (!storeEntry) return;

    const button = document.createElement('button');
    button.id = `toggle-notify-${uuid}`;
    button.textContent = storeEntry.isNotifying ? `Stop ${storeEntry.name} Notifications` : `Start ${storeEntry.name} Notifications`;
    button.disabled = disabled || !storeEntry.characteristicObject;

    button.onclick = async () => {
        if (!storeEntry.characteristicObject) return;
        button.disabled = true;
        try {
            if (storeEntry.isNotifying) {
                await storeEntry.characteristicObject.stopNotifications();
                storeEntry.characteristicObject.removeEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);
                storeEntry.isNotifying = false;
                updateCombinedNotificationStatus(); // Update combined status
            } else {
                // Re-read descriptor in case it's needed, though ideally it's already stored
                if (!storeEntry.descriptor && storeEntry.characteristicObject.getDescriptor) {
                     try {
                        const descriptor = await storeEntry.characteristicObject.getDescriptor('00002904-0000-1000-8000-00805f9b34fb');
                        const value = await descriptor.readValue();
                        storeEntry.descriptor = parseCharacteristicPresentationFormat(value, storeEntry.name);
                    } catch (descErr) {
                        logError(`Could not re-read 0x2904 for ${storeEntry.name} before starting notifications`, descErr);
                    }
                }
                await storeEntry.characteristicObject.startNotifications();
                storeEntry.characteristicObject.addEventListener('characteristicvaluechanged', handleCharacteristicValueChanged);
                storeEntry.isNotifying = true;
                updateCombinedNotificationStatus(); // Update combined status
            }
        } catch (error) {
            logError(`Error toggling notifications for ${storeEntry.name}`, error);
        }
        button.textContent = storeEntry.isNotifying ? `Stop ${storeEntry.name} Notifications` : `Start ${storeEntry.name} Notifications`;
        button.disabled = false;
    };
    if (notificationTogglesDiv) {
        notificationTogglesDiv.appendChild(button);
        notificationTogglesDiv.appendChild(document.createTextNode(" ")); // For spacing
    }
}

/**
 * Initializes the Three.js scene, camera, renderer, cube, and controls.
 */
function initThreeJS() {
    if (renderer) return; // Already initialized

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // Changed to black

    // Camera
    const fov = 75; // Field of View
    const aspect = threeDCanvasContainer ? threeDCanvasContainer.clientWidth / (threeDCanvasContainer.clientHeight || 240) : 16/9; // Use clientHeight or default
    const near = 0.1;
    const far = 100;
    camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(2, 2, 7); // Position camera
    camera.lookAt(0, 0, 0); // Look at the center of the scene

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    if (threeDCanvasContainer) threeDCanvasContainer.appendChild(renderer.domElement);

    // Geometry (proportions 3 wide (X), 5 high (Y), 1 deep (Z))
    const geometry = new THREE.BoxGeometry(3, 5, 1);

    // Materials (6 sides, different colors, not black or green)
    const materials = [
        new THREE.MeshBasicMaterial({ color: 0xff0000 }), // Right face (+X) - Red
        new THREE.MeshBasicMaterial({ color: 0x0000ff }), // Left face (-X) - Blue
        new THREE.MeshBasicMaterial({ color: 0xffff00 }), // Top face (+Y) - Yellow
        new THREE.MeshBasicMaterial({ color: 0x00ffff }), // Bottom face (-Y) - Cyan
        new THREE.MeshBasicMaterial({ color: 0xff00ff }), // Front face (+Z) - Magenta
        new THREE.MeshBasicMaterial({ color: 0xffa500 })  // Back face (-Z) - Orange
    ];

    cube = new THREE.Mesh(geometry, materials);
    scene.add(cube);

    // OrbitControls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
    controls.dampingFactor = 0.05;
    controls.addEventListener('change', renderScene); // Re-render if controls change the camera
    updateCubeRotation(); // Set initial rotation and render
    resizeRendererToDisplaySize(); // Set initial size and render

    window.addEventListener('resize', resizeRendererToDisplaySize);
    animate(); // Start the animation loop
}

/**
 * Resizes the Three.js renderer and camera to fit the container.
 * Called on window resize and initial setup.
 */
function resizeRendererToDisplaySize() {
    if (!renderer || !camera || !threeDCanvasContainer) return;
    const canvas = renderer.domElement;
    const width = threeDCanvasContainer.clientWidth;
    const height = Math.max(200, width * 0.6); // Maintain aspect ratio, min height 200px
    if (canvas.width !== width || canvas.height !== height) {
        renderer.setSize(width, height, false); // false = don't set style
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    }
    renderScene();
}

/**
 * Updates the 3D cube's rotation based on the current slider values or BLE data.
 * Also updates the displayed numerical values for roll, pitch, and yaw.
 */
function updateCubeRotation() {
    if (!cube) return;

    const pitchDeg = pitchInput ? parseFloat(pitchInput.value) : 0;
    const rollDeg = rollInput ? parseFloat(-rollInput.value) : 0; // Note: BLE roll might be inverted depending on sensor
    let yawDeg = yawInput ? parseFloat(yawInput.value) : 0;

    // Update spans with current values, using toFixed(2) for consistency
    if (pitchValueSpan) pitchValueSpan.textContent = pitchDeg.toFixed(2);
    if (rollValueSpan) rollValueSpan.textContent = rollDeg.toFixed(2); // Display the value used for rotation
    if (yawValueSpan) yawValueSpan.textContent = yawDeg.toFixed(2);

    cube.rotation.x = THREE.MathUtils.degToRad(pitchDeg);    // this is Roll around X axis
    cube.rotation.y = THREE.MathUtils.degToRad(rollDeg);   // Pitch around Y axis
    cube.rotation.z = THREE.MathUtils.degToRad(yawDeg);     // this is Yaw around Z axis
    renderScene();
}
/**
 * Renders the Three.js scene using the current camera.
 */
function renderScene() {
    if (renderer && scene && camera) {
        // controls.update() is now handled by the animate() loop
        renderer.render(scene, camera);
    }
}
// Event listeners for 3D model control sliders
if (rollInput) rollInput.addEventListener('input', updateCubeRotation);
if (pitchInput) pitchInput.addEventListener('input', updateCubeRotation);
if (yawInput) yawInput.addEventListener('input', updateCubeRotation);

// Animation loop for damping if used with OrbitControls
/**
 * The main animation loop for Three.js.
 * Required for OrbitControls damping and continuous rendering if autoRotate is enabled.
 * Also ensures the scene is rendered if other visual changes occur.
 */
function animate() {
    requestAnimationFrame(animate);
    if (controls && controls.enableDamping) {
        controls.update(); // only required if controls.enableDamping = true, or if controls.autoRotate = true
    }
    renderScene(); // Render the scene in each animation frame
}
// Note: The animate() function is started within initThreeJS.
// Note: The 'gattserverdisconnected' event listener is added in handleDeviceSelection after successful connection.
