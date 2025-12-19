### RS485 Communication Documentation for Pentair IntelliChlor

Below, I've compiled and summarized documentation and code snippets related to RS485 communication for the Pentair IntelliChlor (a salt chlorinator) from various GitHub sources. This is based on reverse-engineered protocols, as Pentair does not publicly disclose official specs. The protocol is typically 9600 baud, no parity, 1 stop bit (9600N81), and uses half-duplex RS485 buses shared with other Pentair devices like controllers, pumps, and heaters. Communication is packet-based with headers, data, and checksums.

Key points:
- IntelliChlor communicates on the same RS485 bus as the pool controller (e.g., IntelliCenter, EasyTouch).
- It responds to queries and sends status updates (e.g., salinity, output percentage).
- Hardware requires an RS485 adapter (e.g., USB-to-RS485 converter) connected to a computer or microcontroller.
- Packets are 10-29 bytes long, starting with sync bytes (e.g., 0xFF), followed by source/destination IDs, command, data, and checksum.
- IntelliChlor ID is typically 0x10 or similar; controller ID is 0x0F or 0x60.
- For full protocol decoding, refer to the external reference: [Decoding the Pentair EasyTouch RS-485 Protocol](http://www.sdyoung.com/home/decoding-the-pentair-easytouch-rs-485-protocol/).

Sources are limited to top GitHub results; for more, search GitHub for "Pentair IntelliChlor RS485" or similar.

#### 1. General Protocol Overview (from pavsp_rs485_examples and pentair-pool-controler)
- **Hardware Setup**: RS485 bus is active when a Pentair controller is present. Standalone devices (like pumps) may not communicate without a controller initiating.
- **Packet Structure** (example from PACKET_SPEC.txt):
  - Sync: 0xFF, 0x00, 0xFF
  - Source ID: 1 byte
  - Destination ID: 1 byte
  - Command: 1 byte
  - Data Length: 1 byte
  - Data: Variable
  - Checksum: 1 byte (sum of bytes mod 256, inverted or adjusted)
- **Example Queries/Commands**:
  - Query salt percent: 0xFF, 0xFF, ..., 0xA5, 0x07, 0x10, 0x20, 0xD9, 0x01, 0x00, 0x01, 0xB6
  - Responses include salinity (ppm) and output (%).
- **Tools**: Use Linux programs like `aprs485` for bus access. Monitor traffic with a serial port and RS485 adapter.

#### 2. IntelliChlor-Specific Communication (from nodejs-poolController)
- Supported in Node.js pool controller software.
- Requires RS485 adapter.
- IntelliChlor (and Aqua-Rite) integrates with controllers for chlorination control.
- Recent updates (v8.3.0): Configurable RS485 transmit pacing for collision avoidance.
- Dynamic mode: Can be controlled by REM chem controllers on dedicated ports.

#### 3. Protocol Decoding and Examples (from arduino-pentair)
- Reference doc: "Decoding The Pentair EasyTouch RS-485 Protocol" (embedded in repo).
- IntelliChlor salinity output is elusive but decodable via CFI byte in packets.
- Example: Pump communication needs initiation from controller; standalone pumps stay silent.
- Packet example for pump updates: 15-byte message with 0x10, 0x60 prefix for pump data (RPM, watts).
- For chlorinators: Look for messages with specific IDs (e.g., 0x10 for IntelliChlor).
- Forum discussion: Standalone IntelliChlor may need queries to respond; bus is chatty when controller is active.

#### 4. OpenHAB Binding Implementation (from openhab2-addons, openhab-docs, and related repos)
- Binding supports IntelliChlor via RS485 serial bridge.
- **Thing Configuration**:
  - ID: Decimal ID of the device (e.g., 16 for IntelliChlor).
  - Serial Port: e.g., /dev/ttyUSB0.
  - Channels for IntelliChlor:
    - `saltoutput`: Salt output percentage (%).
    - `salinity`: Salinity in ppm.
- **Items Example** (from readme.md):
  ```
  Number SaltOutput "Salt Output [%d%%]" (gPool) { channel = "pentair:intellichlor:1:ic40:saltoutput" }
  Number Salinity "Salinity [%d ppm]" (gPool) { channel = "pentair:intellichlor:1:ic40:salinity" }
  ```
- Bridge: Pentair serial bridge with ID (default 34) for bus commands.
- Protocol: Uses RS485 for real-time data; also supports IP bridge via ScreenLogic.

#### 5. Arduino/ESP8266 Code Snippets (from ESP8266-Pentair)
- Parses RS485 packets for IntelliChlor data.
- **Key Variables**:
  - `saltPct`: Salt output percentage.
  - `salinityNow`: Current salinity.
- **Query Packet** for salt percent:
  ```c++
  uint8_t saltPctQuery[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x00, 0xFF, 0xA5, 0x07, 0x10, 0x20, 0xD9, 0x01, 0x00, 0x01, 0xB6};
  ```
- **Processing Logic** (excerpt from PentairServer.ino):
  ```c++
  if (bufferOfBytes[2] == 0x10 && bufferOfBytes[3] == 0x60 && bufferOfBytes[5] == 0xF) {
      // 15-byte pump message
  }
  // For chlorinator: Check for specific IDs and parse salt data
  saltPct = bufferOfBytes[...]; // Parse from packet
  Serial.println(saltPct);
  ```
- Setup: Uses SoftwareSerial for RX/TX on pins D2/D3; direction control on D1.

#### Additional Notes
- **Checksum Calculation**: Often a sum of packet bytes (excluding sync) mod 256, then adjusted.
- **Troubleshooting**: Ensure controller is active; use oscilloscope for bus activity.
- **Safety**: Pentair cites safety for not sharing protocols, but community reverse-engineering enables integration.
- For implementation, clone repos like `tagyoureit/nodejs-poolController` or `pughjsus/ESP8266-Pentair` and adapt code.

If this isn't sufficient or you need code for a specific repo, provide more details!

Current Date and Time (UTC - YYYY-MM-DD HH:MM:SS formatted): 2025-12-09 20:22:43
Current User's Login: DanielAChandler