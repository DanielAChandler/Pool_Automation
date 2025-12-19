# Pentair IntelliChlor ESPHome Component

ESPHome component for interfacing with Pentair IntelliChlor salt chlorine generators via RS485.

## How It Works

### Internal Functions

The component uses the following internal methods to retrieve sensor data:

- **`read_all_info()`** - Main polling function called by `update()` approximately once per second. Orchestrates all sensor reads.
- **`get_version_()`** - Sends command `0x50, 0x14, 0x00` to retrieve firmware version
- **`get_temp_()`** - Sends command `0x50, 0x15, 0x00` to retrieve water temperature
- **`takeover_()`** - Sends command `0x50, 0x00, 0x00` to enable takeover mode
- **`set_percent_(uint8_t percent)`** - Sends command `0x50, 0x11, percent` to set chlorine output

### Polling Sequence

Every update cycle (default 60 seconds), `read_all_info()` executes:

1. **Get Version** command (`0x50, 0x14, 0x00`) → Updates `version` text sensor
2. **Get Temperature** command (`0x50, 0x15, 0x00`) → Updates `water_temp` sensor

When **takeover mode** is enabled:
3. **Takeover** command (`0x50, 0x00, 0x00`) → Updates `status` sensor
4. **Set Percent** command (`0x50, 0x11, percent`) → Updates `salt_ppm`, `error`, `set_percent` sensors and all 8 binary sensors

The response handler (`readline_()`) parses incoming packets and publishes sensor values automatically.

## Hardware Requirements

- UART interface (RS485 transceiver)
- TX/RX pins connected to IntelliChlor
- Optional: Flow control pin

## Configuration

### Basic Setup

```yaml
external_components:
  - source: components/Pool_Automation/components
    components: [intellichlor]
    refresh: 0s

uart:
  - id: uart_bus
    tx_pin: GPIO17
    rx_pin: GPIO18
    baud_rate: 9600

intellichlor:
  id: my_intellichlor
  uart_id: uart_bus
  update_interval: 60s  # Optional, default is 60s
  flow_control_pin: GPIO19  # Optional
```

## Available Entities

### Sensors

All sensors are optional. Configure only the ones you need:

```yaml
sensor:
  - platform: intellichlor
    salt_ppm:
      name: "Salt Level"
      id: salt_ppm
      # Returns salt concentration in PPM
      
    water_temp:
      name: "Chlorinator Water Temperature"
      id: water_temp
      # Returns water temperature in °F
      
    status:
      name: "Chlorinator Status"
      id: chlorinator_status
      # Numeric status code
      
    error:
      name: "Chlorinator Error"
      id: chlorinator_error
      # Numeric error code
      
    set_percent:
      name: "Chlorinator Output %"
      id: chlorinator_set_percent
      # Current chlorine production percentage (0-100)
```

### Binary Sensors

Monitor various alarm conditions:

```yaml
binary_sensor:
  - platform: intellichlor
    no_flow:
      name: "No Flow Alarm"
      # Triggered when flow switch detects no water flow
      
    low_salt:
      name: "Low Salt Alarm"
      # Salt level too low
      
    high_salt:
      name: "High Salt Alarm"
      # Salt level too high
      
    clean:
      name: "Clean Cell Required"
      # Cell requires cleaning
      
    high_current:
      name: "High Current Alarm"
      # Excessive current draw
      
    low_volts:
      name: "Low Voltage Alarm"
      # Voltage below threshold
      
    low_temp:
      name: "Low Temperature Alarm"
      # Water temperature too low for operation
      
    check_pcb:
      name: "Check PCB"
      # PCB issue detected
```

### Text Sensors

```yaml
text_sensor:
  - platform: intellichlor
    version:
      name: "Chlorinator Version"
      # Firmware version
      
    swg_debug:
      name: "SWG Debug Info"
      # Debug information string
```

### Number Control

Control chlorine output percentage:

```yaml
number:
  - platform: intellichlor
    swg_percent:
      name: "Chlorine Output"
      # Set chlorine production percentage (0-100)
      # Range: 0-100, Step: 1
```

### Switch

```yaml
switch:
  - platform: intellichlor
    takeover_mode:
      name: "Takeover Mode"
      # Enable/disable takeover mode
      # Allows ESP to control chlorinator settings
```

## Complete Example

```yaml
external_components:
  - source: components/Pool_Automation/components
    components: [intellichlor]
    refresh: 0s

uart:
  - id: uart_bus
    tx_pin: GPIO17
    rx_pin: GPIO18
    baud_rate: 9600

intellichlor:
  id: my_intellichlor
  uart_id: uart_bus
  update_interval: 60s

sensor:
  - platform: intellichlor
    salt_ppm:
      name: "Salt Level"
    water_temp:
      name: "Chlorinator Water Temperature"
    set_percent:
      name: "Chlorinator Output %"

binary_sensor:
  - platform: intellichlor
    no_flow:
      name: "No Flow Alarm"
    low_salt:
      name: "Low Salt Alarm"
    clean:
      name: "Clean Cell Required"

text_sensor:
  - platform: intellichlor
    version:
      name: "Chlorinator Version"

number:
  - platform: intellichlor
    swg_percent:
      name: "Chlorine Output"

switch:
  - platform: intellichlor
    takeover_mode:
      name: "Takeover Mode"
```

## Notes

- Requires 9600 baud RS485 connection
- Poll interval default is 60 seconds
- All entities are optional - configure only what you need
- Takeover mode must be enabled to control the chlorinator from ESPHome
- Water temperature is reported in Fahrenheit
- Salt level is reported in PPM (parts per million)

## Usage Examples

### Manually Trigger Sensor Read

You can manually trigger `read_all_info()` from automations:

```yaml
button:
  - platform: template
    name: "Refresh Chlorinator"
    on_press:
      - lambda: |-
          id(my_intellichlor).read_all_info();
```

### Update Chlorine Output from Automation

When takeover mode is active, changes to the number control trigger `set_swg_percent()`:

```yaml
automation:
  - platform: time
    at: "10:00:00"
    then:
      - number.set:
          id: swg_percent_number
          value: 80
      # This automatically calls set_swg_percent() which triggers read_all_info()
```

### Monitor Salt Level

```yaml
automation:
  - platform: numeric_state
    entity_id: sensor.salt_ppm
    below: 2700
    then:
      - homeassistant.service:
          service: notify.mobile_app
          data:
            message: "Pool salt level low: {{ states('sensor.salt_ppm') }} PPM"
```

### React to Alarms

```yaml
automation:
  - platform: state
    entity_id: binary_sensor.no_flow
    to: 'on'
    then:
      - switch.turn_off: takeover_mode
      - logger.log: "No flow detected! Disabling takeover mode"
```
