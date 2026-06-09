"use server";

import prisma from "@parqueadero/database";
import { revalidatePath } from "next/cache";
import { sendMail } from "@/lib/email";
import { approvedEmailHtml, rejectedEmailHtml } from "@/lib/email-templates";

export async function updateRegistrationStatus(id: number, status: string, rejectionReason?: string) {
  try {
    let registrationData: {
      fullName: string;
      email: string;
      plate: string;
      vehicleBrand?: string | null;
      vehicleModel?: string | null;
      institutionalCode: string;
      rejectionReason?: string;
    } | null = null;

    // If approving, we need to create the permanent records
    if (status === "APROBADO") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await prisma.$transaction(async (tx: any) => {
        // 1. Get current registration data
        const reg = await tx.userRegistration.findUnique({
          where: { id },
        });

        if (!reg) throw new Error("Solicitud no encontrada.");
        if (reg.status !== "PENDIENTE") throw new Error("La solicitud ya fue procesada.");

        // Store for email notification (after transaction)
        registrationData = {
          fullName: reg.fullName,
          email: reg.email,
          plate: reg.plate,
          vehicleBrand: reg.vehicleBrand,
          vehicleModel: reg.vehicleModel,
          institutionalCode: reg.institutionalCode,
        };

        // 2. Split Name (Simple split: first word as firstname, rest as surname)
        const nameParts = reg.fullName.trim().split(/\s+/);
        const firstname = nameParts[0] || "Usuario";
        const surname = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "S/A";

        // 3. Crear o encontrar estudiante
        const student = await tx.student.upsert({
          where: { cardnumber: reg.institutionalCode },
          update: {
            email: reg.email,
            userType: reg.userType,   // Propagar el tipo de usuario desde la solicitud
          },
          create: {
            cardnumber: reg.institutionalCode,
            firstname,
            surname,
            email: reg.email,
            userType: reg.userType,   // Guardar el tipo de usuario al crear el estudiante
          },
        });

        await tx.vehicle.upsert({
          where: { plate: reg.plate.toUpperCase().trim() },
          update: {
            ownerId: student.id,
            department: reg.userType,
            brand: reg.vehicleBrand,
            model: reg.vehicleModel || "N/A",
          },
          create: {
            plate: reg.plate.toUpperCase().trim(),
            ownerId: student.id,
            brand: reg.vehicleBrand,
            model: reg.vehicleModel || "N/A",
            color: "N/A",
            icon: "directions_car",
            department: reg.userType,
            status: "ACTIVO",
          },
        });

        await tx.userRegistration.update({
          where: { id },
          data: { status: "APROBADO" },
        });
      });
    } else {
      // Fetch data before updating so we can send the rejection email
      const reg = await prisma.userRegistration.findUnique({
        where: { id },
        select: {
          fullName: true,
          email: true,
          plate: true,
          vehicleBrand: true,
          vehicleModel: true,
          institutionalCode: true,
          status: true,
        },
      });

      if (!reg) throw new Error("Solicitud no encontrada.");
      if (reg.status !== "PENDIENTE") throw new Error("La solicitud ya fue procesada.");

      registrationData = {
        ...reg,
        rejectionReason
      };

      await prisma.userRegistration.update({
        where: { id },
        data: { status },
      });
    }

    // --- Send email notification ---
    // DB update already succeeded above; email errors surface as a warning, not a failure.
    let emailError: string | undefined;
    if (registrationData) {
      const data = registrationData;
      const isApproved = status === "APROBADO";

      try {
        await sendMail({
          to: data.email,
          subject: isApproved
            ? "✅ Tu acceso al parqueadero UFPS fue aprobado"
            : "❌ Tu solicitud de acceso al parqueadero UFPS no fue aprobada",
          html: isApproved
            ? approvedEmailHtml(data)
            : rejectedEmailHtml(data),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[sendMail] Error:", msg);
        // Surface the error to the admin so they know the email didn't go out
        emailError = `El estado fue actualizado, pero el correo no se pudo enviar: ${msg}`;
      }
    }

    revalidatePath("/solicitudes-registro");
    revalidatePath("/students");
    revalidatePath("/vehicles");

    return { success: true, emailError };
  } catch (error: unknown) {
    console.error("Error updating status:", error);
    const errorMessage =
      error instanceof Error ? error.message : "No se pudo actualizar el estado.";
    return { error: errorMessage };
  }
}
