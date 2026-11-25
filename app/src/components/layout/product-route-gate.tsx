import { productFeatureForPath } from "@openbot/shared/product-capabilities";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { deploymentCapabilitiesQueryOptions } from "@/lib/deployment/queries";

/** Keep unsupported screens out of the mounted tree, including their API polling and actions. */
export function ProductRouteGate({ children }: { children: ReactNode }) {
  const pathname = useLocation({ select: (location) => location.pathname });
  const { data, isPending, isError } = useQuery(
    deploymentCapabilitiesQueryOptions(),
  );
  const feature = productFeatureForPath(pathname);
  if (!feature) return children;
  if (isPending)
    return (
      <p role="status" className="p-6">
        Verificando disponibilidade…
      </p>
    );
  if (isError)
    return (
      <p role="alert" className="p-6">
        Não foi possível verificar a disponibilidade. Recarregue a página.
      </p>
    );
  const capability = data?.standalone ? data.features?.[feature] : undefined;
  if (!data?.standalone || capability?.state === "available") return children;
  return (
    <main className="m-auto max-w-lg space-y-4 p-8">
      <h1 className="text-xl font-semibold">
        {capability?.label ?? "Recurso indisponível"}
      </h1>
      <p role="status">
        {capability?.state === "out_of_scope"
          ? "Este recurso não faz parte do Plugueme V1."
          : capability?.state === "in_development"
            ? "Este recurso está em desenvolvimento e ainda não pode ser utilizado."
            : "Este recurso está indisponível nesta instalação."}
      </p>
      <Link to="/" className="underline">
        Voltar às conversas
      </Link>
    </main>
  );
}
