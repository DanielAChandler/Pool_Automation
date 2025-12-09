# IntelliChlor RS485 Protocol Cheat Sheet

## Overview

This document serves as a practical cheat sheet for communicating with Pentair IntelliChlor salt chlorinators over RS485. The information is based on publicly shared protocol captures and reverse-engineering efforts from the community. This guide provides frame formats, key commands, timing requirements, and example code snippets to help implement IntelliChlor control in custom automation systems.

**Note:** The protocol information in this document comes from publicly shared captures and community documentation. Always validate against your specific hardware.

## Frame Format

IntelliChlor uses a simple framing structure for RS485 communication:

```
┌─────────┬─────────┬──────────────────────┬─────────┬─────────┐
│ Header  │         │      Payload         │         │ Footer  │
│ 0x10    │  0x02   │ [DEST][CMD][DATA...] │  [CHK]  │ 0x10 0x03│
└─────────┴─────────┴──────────────────────┴─────────┴─────────┘
```

### Frame Components

- **Header**: `0x10 0x02` - Marks the start of frame
- **DEST**: Destination address (1 byte)
  - `0x50` - Common destination for IntelliChlor
- **CMD**: Command byte (1 byte)
- **DATA**: Variable length data bytes (0-n bytes)
- **CHK**: Checksum (1 byte)
- **Footer**: `0x10 0x03` - Marks the end of frame

### Checksum Calculation

The checksum is calculated as an 8-bit sum of all payload bytes (DEST + CMD + DATA...) masked with `0xFF`:

```python
checksum = (dest + cmd + sum(data_bytes)) & 0xFF
```

**Important:** This checksum rule should be verified against actual hardware responses, as variations may exist.

## Key Commands

### Ping / Status Poll

**Request:**
```
10 02 50 00 CS 10 03
```

**Example Response:**
```
10 02 00 01 00 00 13 10 03
```

This command queries the IntelliChlor for basic status information.

### Set Output Percentage

**Request:**
```
10 02 50 11 PP CS 10 03
```

Where:
- `PP` = Output percentage (0x00 to 0x64 for 0-100%)

**Critical Timing Note:** The output percentage command must be refreshed approximately every 0.5 seconds (500 ms) to maintain remote control. If the command is not sent regularly, the cell will exit remote control mode and revert to local/manual operation.

**Example - Set 50% output:**
```
10 02 50 11 32 93 10 03
```

### Read Salinity and Status

**Request:**
```
10 02 50 12 00 CS 10 03
```

**Example Response:**
```
10 02 00 12 SS 00 VV 10 03
```

Where:
- `SS` = Salinity value (raw)
- `VV` = Variable status byte (varies, confirm with captures)

**Salinity Approximation:**
```
Salinity (ppm) ≈ SS × 50
```

Example: `0x40` (64 decimal) ≈ 3200 ppm

**Note:** The salinity scaling factor and the meaning of the VV byte should be confirmed with actual hardware captures and may vary by model.

### Experimental Commands

The following commands have been observed but are less consistent:
- **CMD 0x20** - Function varies
- **CMD 0x01** - Function varies

These should be considered experimental and validated thoroughly before use.

## Timing and Bus Etiquette

### UART Settings

- **Baud Rate**: 9600
- **Data Bits**: 8
- **Parity**: None
- **Stop Bits**: 1
- **Mode**: Half-duplex RS485

### Timing Requirements

Proper timing is critical for reliable RS485 communication:

- **Quiet time before TX**: 40-80 ms
  - Wait this duration after last bus activity before transmitting
- **Inter-frame delay**: 30-75 ms
  - Delay between consecutive frames
- **Inter-byte delay**: 0-2 ms
  - Only add delay if experiencing overrun errors

### RS485 Driver Control

- **DE (Driver Enable)**: Assert HIGH only while transmitting
- **RE (Receiver Enable)**: Assert LOW to enable receiver (typically inverted from DE)
- Release DE/RE immediately after transmission to listen for responses

### Shared Bus Considerations

When sharing the bus with Pentair control panels or other devices, longer idle and inter-frame delays may be necessary to avoid collisions. Monitor the bus for activity before transmitting.

## Wiring

### RS485 Connection

Standard RS485 differential pair wiring:

```
┌─────────────┐         ┌─────────────┐
│   Device A  │         │   Device B  │
│             │         │             │
│  A (D+) ────┼─────────┼──── A (D+)  │
│  B (D-) ────┼─────────┼──── B (D-)  │
│  GND    ────┼─────────┼──── GND     │
└─────────────┘         └─────────────┘
```

- **A (D+)**: Non-inverting signal line
- **B (D-)**: Inverting signal line
- **GND**: Common ground reference (required for reliable communication)

### Termination

- **Long runs**: 120Ω termination resistor between A and B at each end of the bus
- **Short runs**: Often no termination needed for runs under 10 feet
- Test both configurations if experiencing communication issues

### Troubleshooting

If responses are empty or garbled:
1. **Flip A/B**: Try swapping A and B connections
2. **Check ground**: Ensure GND is connected between all devices
3. **Slow pacing**: Increase inter-frame delays to 100+ ms
4. **Verify voltage levels**: Use a multimeter or oscilloscope to check differential signals

## Practical Sequences

### Periodic Setpoint Control

To maintain remote control of output percentage:

```
1. Send set output command (CMD 0x11)
2. Wait ~500 ms
3. Repeat indefinitely while control is desired
```

### Poll Salinity and Status

```
1. Send read salinity command (CMD 0x12)
2. Wait for response (typically 50-100 ms)
3. Parse response:
   - Check header (0x10 0x02) and footer (0x10 0x03)
   - Extract salinity byte (SS)
   - Calculate ppm = SS × 50
4. Repeat at desired interval (e.g., every 10 seconds)
```

### Response Parsing

All valid responses should:
- Start with `0x10 0x02`
- End with `0x10 0x03`
- Have valid checksum

Discard frames that don't meet these criteria.

## Example Code Snippets

### Python with PySerial

```python
import serial
import time

class IntelliChlorRS485:
    def __init__(self, port='/dev/ttyUSB0', baudrate=9600):
        self.ser = serial.Serial(
            port=port,
            baudrate=baudrate,
            bytesize=serial.EIGHTBITS,
            parity=serial.PARITY_NONE,
            stopbits=serial.STOPBITS_ONE,
            timeout=1
        )
        time.sleep(0.1)  # Allow port to stabilize
    
    def calculate_checksum(self, payload):
        """Calculate 8-bit checksum for payload bytes."""
        return sum(payload) & 0xFF
    
    def send_frame(self, dest, cmd, data=[]):
        """Send a framed command to IntelliChlor."""
        # Build payload
        payload = [dest, cmd] + data
        checksum = self.calculate_checksum(payload)
        
        # Build complete frame
        frame = [0x10, 0x02] + payload + [checksum, 0x10, 0x03]
        
        # Wait for bus quiet time
        time.sleep(0.05)  # 50 ms quiet time
        
        # Send frame
        self.ser.write(bytes(frame))
        
        # Wait inter-byte time
        time.sleep(0.002)  # 2 ms
    
    def read_response(self, timeout=0.5):
        """Read and parse response frame."""
        start_time = time.time()
        buffer = []
        
        while (time.time() - start_time) < timeout:
            if self.ser.in_waiting > 0:
                byte = self.ser.read(1)[0]
                buffer.append(byte)
                
                # Check for complete frame
                if len(buffer) >= 4 and buffer[-2:] == [0x10, 0x03]:
                    return buffer
        
        return None
    
    def set_output_percent(self, percent):
        """Set chlorinator output percentage (0-100)."""
        if not 0 <= percent <= 100:
            raise ValueError("Percent must be 0-100")
        
        self.send_frame(dest=0x50, cmd=0x11, data=[percent])
    
    def read_salinity(self):
        """Read salinity from IntelliChlor."""
        # Send read salinity command
        self.send_frame(dest=0x50, cmd=0x12, data=[0x00])
        
        # Read response
        response = self.read_response()
        
        if response and len(response) >= 8:
            # Parse response: 10 02 00 12 SS 00 VV CS 10 03
            if response[0:2] == [0x10, 0x02] and response[-2:] == [0x10, 0x03]:
                salinity_raw = response[4]
                salinity_ppm = salinity_raw * 50
                return salinity_ppm
        
        return None
    
    def maintain_output_control(self, percent):
        """Continuously maintain output control (call periodically)."""
        while True:
            self.set_output_percent(percent)
            time.sleep(0.5)  # Refresh every 500 ms

# Example usage
if __name__ == "__main__":
    ic = IntelliChlorRS485(port='/dev/ttyUSB0')
    
    # Read salinity
    salinity = ic.read_salinity()
    if salinity:
        print(f"Salinity: {salinity} ppm")
    
    # Set output to 50% for 10 seconds
    start = time.time()
    while time.time() - start < 10:
        ic.set_output_percent(50)
        time.sleep(0.5)
    
    # Turn off
    ic.set_output_percent(0)
```

### ESP32/Arduino Pseudocode

```cpp
// RS485 Control Pins
#define RS485_TX_PIN 17
#define RS485_RX_PIN 16
#define RS485_DE_RE_PIN 4  // Driver Enable / Receiver Enable

// UART Configuration
HardwareSerial RS485Serial(1);

void setup() {
    Serial.begin(115200);
    
    // Initialize RS485 serial
    RS485Serial.begin(9600, SERIAL_8N1, RS485_RX_PIN, RS485_TX_PIN);
    
    // Initialize DE/RE pin (LOW = receive, HIGH = transmit)
    pinMode(RS485_DE_RE_PIN, OUTPUT);
    digitalWrite(RS485_DE_RE_PIN, LOW);  // Start in receive mode
    
    delay(100);
}

uint8_t calculateChecksum(uint8_t* payload, uint8_t len) {
    uint8_t sum = 0;
    for (uint8_t i = 0; i < len; i++) {
        sum += payload[i];
    }
    return sum & 0xFF;
}

void sendFrame(uint8_t dest, uint8_t cmd, uint8_t* data, uint8_t dataLen) {
    // Build payload
    uint8_t payload[32];
    payload[0] = dest;
    payload[1] = cmd;
    for (uint8_t i = 0; i < dataLen; i++) {
        payload[2 + i] = data[i];
    }
    
    uint8_t payloadLen = 2 + dataLen;
    uint8_t checksum = calculateChecksum(payload, payloadLen);
    
    // Wait for bus quiet time
    delay(50);  // 50 ms
    
    // Switch to transmit mode
    digitalWrite(RS485_DE_RE_PIN, HIGH);
    delayMicroseconds(10);
    
    // Send frame
    RS485Serial.write(0x10);
    RS485Serial.write(0x02);
    RS485Serial.write(payload, payloadLen);
    RS485Serial.write(checksum);
    RS485Serial.write(0x10);
    RS485Serial.write(0x03);
    RS485Serial.flush();
    
    // Switch back to receive mode
    delayMicroseconds(10);
    digitalWrite(RS485_DE_RE_PIN, LOW);
}

void setOutputPercent(uint8_t percent) {
    if (percent > 100) percent = 100;
    
    uint8_t data[1] = {percent};
    sendFrame(0x50, 0x11, data, 1);
}

void readSalinity() {
    uint8_t data[1] = {0x00};
    sendFrame(0x50, 0x12, data, 1);
}

void loop() {
    // Maintain 50% output
    setOutputPercent(50);
    delay(500);  // Refresh every 500 ms
    
    // Periodically read salinity
    static unsigned long lastSalinityRead = 0;
    if (millis() - lastSalinityRead > 10000) {  // Every 10 seconds
        readSalinity();
        
        // Wait and parse response
        delay(100);
        if (RS485Serial.available() >= 8) {
            uint8_t response[32];
            uint8_t len = 0;
            while (RS485Serial.available() && len < 32) {
                response[len++] = RS485Serial.read();
            }
            
            // Parse salinity: look for 10 02 00 12 SS ...
            if (len >= 8 && response[0] == 0x10 && response[1] == 0x02) {
                uint8_t salinityRaw = response[4];
                uint16_t salinityPpm = salinityRaw * 50;
                Serial.printf("Salinity: %d ppm\n", salinityPpm);
            }
        }
        
        lastSalinityRead = millis();
    }
}
```

## Caveats

### Validation Required

The following aspects of this protocol should be validated against live hardware:

1. **Checksum Calculation**: The 8-bit sum formula should be verified with actual responses. Some variations may use different checksum algorithms.

2. **Salinity Scaling**: The `ppm ≈ SS × 50` approximation should be confirmed with known salinity values and lab measurements.

3. **Response Format**: The meaning of variable bytes (like VV in the salinity response) should be confirmed through systematic testing.

4. **Model Variations**: Different IntelliChlor models (IC20, IC40, IC60) may have subtle protocol differences.

### Shared Bus Considerations

When the IntelliChlor shares an RS485 bus with Pentair control panels (IntelliCenter, EasyTouch, etc.):

- **Longer delays required**: Increase idle/inter-frame delays to 80-150 ms to avoid collisions
- **Bus monitoring**: Listen for existing traffic patterns before transmitting
- **Collision detection**: Implement retry logic if responses are not received
- **Bus priority**: Control panels typically have priority; wait for gaps in their communication

### Development Best Practices

1. **Start with monitoring**: Use an RS485 sniffer to capture existing traffic before implementing control
2. **Incremental testing**: Test each command individually before combining them
3. **Logging**: Log all transmitted and received frames for debugging
4. **Hardware protection**: Use proper RS485 transceivers with ESD protection
5. **Isolation**: Consider using isolated RS485 adapters to protect host equipment

---

*This document is based on publicly available protocol captures and community reverse-engineering efforts. Always test thoroughly with your specific hardware configuration.*
