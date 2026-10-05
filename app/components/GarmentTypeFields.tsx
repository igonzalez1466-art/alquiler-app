"use client";
import { useState } from "react";
import { ACCESSORY_OPTIONS } from "@/app/lib/listingAttributes";
export default function GarmentTypeFields({ garmentType = "", accessoryType = "", required = false, className = "", inputClassName = "w-full border rounded-lg px-3 py-2 text-sm" }: { garmentType?: string; accessoryType?: string; required?: boolean; className?: string; inputClassName?: string }) {
  const [garment, setGarment] = useState(garmentType);
  const [accessory, setAccessory] = useState(accessoryType);
  return <div className={className}><div className="grid grid-cols-1 md:grid-cols-2 gap-3">
    <label className="text-sm"><span className="block text-xs text-gray-600 mb-1">Rodzaj przedmiotu</span>
      <select name="garmentType" required={required} value={garment} onChange={e => { setGarment(e.target.value); setAccessory(""); }} className={inputClassName}>
      <option value="">{required ? "Wybierz" : "Wszystkie"}</option>
                <option value="TRAJE">Garnitur</option>
                <option value="VESTIDO">Sukienka</option>
                <option value="MARYNARKA">Marynarka</option>
                <option value="CAMISA">Koszula</option>
                <option value="BLUSA">Bluzka</option>
                <option value="PANTALON">Spodnie</option>
                <option value="FALDA">Spódnica</option>

                <option value="ABRIGO">Płaszcz</option>
                <option value="CHAQUETA">Kurtka</option>

                <option value="SUDADERA">Bluza</option>
                <option value="JERSEY">Sweter</option>
                <option value="MONO">Kombinezon</option>

                <option value="ACCESORIO">Akcesoria</option>
                <option value="ZAPATO">Buty</option>
                <option value="OTRO">Inne</option>
      </select></label>
    {garment === "ACCESORIO" && <label className="text-sm"><span className="block text-xs text-gray-600 mb-1">Rodzaj akcesorium</span>
      <select name="accessoryType" required={required} value={accessory} onChange={e => setAccessory(e.target.value)} className={inputClassName}>
        <option value="">{required ? "Wybierz akcesorium" : "Wszystkie akcesoria"}</option>
        {ACCESSORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select></label>}
  </div></div>;
}
