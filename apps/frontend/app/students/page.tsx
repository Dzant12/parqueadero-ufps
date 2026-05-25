export const dynamic = "force-dynamic";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Directorio de Estudiantes - Campus ParkGuard",
  description: "Gestionar estudiantes registrados para el estacionamiento del campus",
};

import prisma from "@parqueadero/database";
import Link from "next/link";

const UFPS_DOMAIN = "@ufps.edu.co";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; page?: string }>;
}) {
  const resolvedParams = await searchParams;
  const currentPage = Number(resolvedParams.page) || 1;
  const query = resolvedParams.query || "";
  const ITEMS_PER_PAGE = 50;

  // Only show students that have at least one @ufps.edu.co email
  const emailFilter = {
    OR: [
      { email: { contains: UFPS_DOMAIN } },
      { emailpro: { contains: UFPS_DOMAIN } },
    ],
  };

  const searchFilters = query
    ? {
        OR: [
          { cardnumber: { contains: query } },
          { firstname: { contains: query, mode: "insensitive" as const } },
          { surname: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : undefined;

  const filters = searchFilters
    ? { AND: [emailFilter, searchFilters] }
    : emailFilter;

  const totalFilteredStudents = await prisma.student.count({ where: filters });

  const students = await prisma.student.findMany({
    where: filters,
    take: ITEMS_PER_PAGE,
    skip: (currentPage - 1) * ITEMS_PER_PAGE,
    orderBy: { id: "desc" },
    include: { vehicles: true },
  });

  return (
    <div className="page-wrapper space-y-6">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Directorio de Estudiantes</h2>
          <p className="page-subtitle">
            {query
              ? `Se encontraron ${totalFilteredStudents.toLocaleString()} coincidencias para "${query}"`
              : `${totalFilteredStudents.toLocaleString()} estudiantes con correo @ufps.edu.co registrados`}
          </p>
        </div>
      </div>

      <div className="filter-bar">
        <form method="GET" action="/students" className="search-input-wrapper max-w-md">
          <span className="material-symbols-outlined search-icon">search</span>
          <input
            type="text"
            name="query"
            defaultValue={query}
            placeholder="Buscar por ID, Nombre o Apellido..."
            className="search-input"
          />
        </form>
      </div>

      {/* Data Table */}
      <div className="table-wrapper">
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead className="table-thead">
              <tr>
                <th>ID (Número de Carnet)</th>
                <th>Nombre</th>
                <th>Apellido</th>
                <th>Correo Institucional</th>
                <th>Vehículos Vinculados</th>
              </tr>
            </thead>
            <tbody>
              {students.map(
                (student: {
                  id: number;
                  cardnumber: string;
                  firstname: string;
                  surname: string;
                  email: string | null;
                  emailpro: string | null;
                  vehicles: Record<string, unknown>[];
                }) => {
                  // Pick whichever field contains the @ufps.edu.co address
                  const institutionalEmail =
                    [student.email, student.emailpro].find(
                      (e) => e && e.toLowerCase().includes(UFPS_DOMAIN)
                    ) ?? null;

                  return (
                    <tr key={student.id} className="table-row group">
                      <td className="table-cell font-mono font-bold text-[var(--color-primary)]">
                        {student.cardnumber}
                      </td>
                      <td className="table-cell font-bold text-[var(--color-on-surface)]">
                        {student.firstname}
                      </td>
                      <td className="table-cell text-[var(--color-on-surface-variant)]">
                        {student.surname}
                      </td>
                      <td className="table-cell">
                        {institutionalEmail ? (
                          <span className="inline-flex items-center gap-1.5 badge badge-info">
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: "14px" }}
                            >
                              mail
                            </span>
                            {institutionalEmail}
                          </span>
                        ) : (
                          <span className="badge badge-neutral">Sin correo</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <span
                          className={`badge ${
                            student.vehicles.length > 0
                              ? "badge-warning"
                              : "badge-neutral"
                          }`}
                        >
                          {student.vehicles.length > 0
                            ? `${student.vehicles.length} Vehículo(s)`
                            : "Ninguno"}
                        </span>
                      </td>

                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <span className="table-footer-text">
            Página {currentPage} de{" "}
            {Math.ceil(totalFilteredStudents / ITEMS_PER_PAGE) || 1}
          </span>
          <div className="flex gap-2">
            {currentPage > 1 ? (
              <Link
                href={`/students?page=${currentPage - 1}${
                  query ? `&query=${encodeURIComponent(query)}` : ""
                }`}
                className="pagination-btn"
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </Link>
            ) : (
              <button disabled className="pagination-btn">
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
            )}
            <button className="pagination-btn active">{currentPage}</button>
            {currentPage * ITEMS_PER_PAGE < totalFilteredStudents ? (
              <Link
                href={`/students?page=${currentPage + 1}${
                  query ? `&query=${encodeURIComponent(query)}` : ""
                }`}
                className="pagination-btn"
              >
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </Link>
            ) : (
              <button disabled className="pagination-btn">
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
