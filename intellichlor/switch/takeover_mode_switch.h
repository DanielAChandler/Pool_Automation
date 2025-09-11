#pragma once

#include "esphome/components/switch/switch.h"
#include "../intellichlor.h"

namespace esphome {
namespace intellichlor {

class TakeoverModeSwitch : public switch_::Switch, public Parented<INTELLICHLORComponent> {
 public:
  TakeoverModeSwitch() = default;

 protected:
  void write_state(bool state) override;
};

}  // namespace intellichlor
}  // namespace esphome
