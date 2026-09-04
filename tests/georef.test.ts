import assert from "node:assert/strict";
import test from "node:test";
import { georefSearchUrl, parseGeorefResults } from "../lib/georef.ts";

test("arma una búsqueda de direcciones argentina", () => {
  const url = georefSearchUrl("Avenida Corrientes 1000, CABA");
  assert.equal(url.origin, "https://apis.datos.gob.ar");
  assert.equal(url.searchParams.get("direccion"), "Avenida Corrientes 1000, CABA");
  assert.equal(url.searchParams.get("max"), "8");
});

test("convierte resultados de Georef y descarta ubicaciones incompletas", () => {
  assert.deepEqual(parseGeorefResults({ direcciones: [
    { nomenclatura: "AV CORRIENTES 1000, CABA", ubicacion: { lat: -34.6036, lon: -58.381 } },
    { nomenclatura: "SIN PUNTO" },
  ] }), [{ label: "AV CORRIENTES 1000, CABA", latitude: -34.6036, longitude: -58.381 }]);
});
