export function createBuilding(type, buildingModels) {
  const model = buildingModels[type];
  if (!model) {
    console.warn(`Model for ${type} not loaded yet`);
    return null;
  }
  return model.clone(true);  // deep clone to avoid shared state
}
