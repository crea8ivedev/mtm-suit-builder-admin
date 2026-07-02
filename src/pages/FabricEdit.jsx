import { useParams } from "react-router-dom";
import FabricForm from "./FabricForm";

export default function FabricEdit() {
  const { productId } = useParams();
  return <FabricForm mode="edit" productId={productId} />;
}
