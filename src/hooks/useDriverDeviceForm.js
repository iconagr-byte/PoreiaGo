import { useEffect, useState } from "react";
import {
  getDriverDeviceForm,
  getDriverOrientation,
  watchDriverDeviceForm,
} from "../lib/driver/driverDeviceForm";

/**
 * Phone vs tablet (+ orientation) for the driver PWA shell.
 */
export function useDriverDeviceForm() {
  const [form, setForm] = useState(() => getDriverDeviceForm());
  const [orientation, setOrientation] = useState(() => getDriverOrientation());

  useEffect(() => {
    return watchDriverDeviceForm(({ form: nextForm, orientation: nextOrientation }) => {
      setForm(nextForm);
      setOrientation(nextOrientation);
    });
  }, []);

  return {
    form,
    orientation,
    isTablet: form === "tablet",
    isPhone: form === "phone",
    isLandscape: orientation === "landscape",
  };
}
