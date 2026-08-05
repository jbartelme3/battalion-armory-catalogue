import { cadetsApi } from "../api/client";
import CadetForm from "./CadetForm";

export default function AddCadetForm({ onCreated }: { onCreated: () => void }) {
  return (
    <CadetForm
      submitLabel="Add Cadet"
      onSubmit={async (values) => {
        await cadetsApi.create(values);
        onCreated();
      }}
    />
  );
}
