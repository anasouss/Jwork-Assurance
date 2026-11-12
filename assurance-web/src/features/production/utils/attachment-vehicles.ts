import type { DocumentOwnerOption, PieceJointe, TypePieceJointe } from "../types";

export function vehiclesWithoutDocument(
  vehicles: DocumentOwnerOption[],
  pieces: PieceJointe[],
  type?: TypePieceJointe,
) {
  if (type?.documentOwner !== "VEHICULE") return vehicles;
  const coveredVehicleIds = new Set(pieces
    .filter((piece) => !piece.archived && piece.status !== "ARCHIVED")
    .filter((piece) => piece.typePieceJointeId === type.id
      || (Boolean(type.naturePieceJointeId) && piece.naturePieceJointeId === type.naturePieceJointeId))
    .map((piece) => piece.vehiculeId)
    .filter(Boolean));
  return vehicles.filter((vehicle) => !coveredVehicleIds.has(vehicle.id));
}
