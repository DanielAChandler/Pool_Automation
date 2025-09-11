#pragma once

#include "esphome/components/number/number.h"
#include "../intellichlor.h"

namespace esphome {
namespace intellichlor {

class SWGPercentNumber : public number::Number, public Parented<INTELLICHLORComponent> {
 public:
  SWGPercentNumber() = default;

 protected:
  void control(float value) override;
};

}  // namespace intellichlor
}  // namespace esphome
