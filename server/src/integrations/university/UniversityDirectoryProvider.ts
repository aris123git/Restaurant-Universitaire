/**
 * Annuaire des étudiants inscrits à l'université.
 *
 * Les numéros autorisés à réserver viennent de la base universitaire.
 * L'API officielle n'est pas encore disponible : ce provider reste un stub.
 * En attendant, l'administration importe un fichier (CSV / JSON) dans enrolled_students.
 */
export type UniversityStudentRecord = {
  phone: string;
  studentNumber?: string;
  fullName?: string;
};

export interface UniversityDirectoryProvider {
  readonly name: string;
  readonly implemented: boolean;
  fetchEnrolledStudents(): Promise<UniversityStudentRecord[]>;
}

export class UniversityDirectoryProviderStub implements UniversityDirectoryProvider {
  readonly name = "university_directory";
  readonly implemented = false;

  async fetchEnrolledStudents(): Promise<UniversityStudentRecord[]> {
    throw new Error(
      "L'annuaire universitaire n'est pas intégré. Les spécifications officielles (URL, authentification, format) n'ont pas encore été fournies. Importez les numéros via l'administration en attendant.",
    );
  }
}
