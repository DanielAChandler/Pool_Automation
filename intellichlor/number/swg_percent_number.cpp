#include "swg_percent_number.h"

namespace esphome {
namespace intellichlor {

void SWGPercentNumber::control(float value) {
  this->publish_state(value);
  this->parent_->set_swg_percent();
}

}  // namespace intellichlor
}  // namespace esphome
