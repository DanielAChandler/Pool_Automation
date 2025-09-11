#include "takeover_mode_switch.h"

namespace esphome {
namespace intellichlor {

void TakeoverModeSwitch::write_state(bool state) {
  this->publish_state(state);
  this->parent_->set_takeover_mode(state);
}

}  // namespace intellichlor
}  // namespace esphome
