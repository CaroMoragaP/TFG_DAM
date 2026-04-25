const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export type HealthResponse = {
  service: string;
  status: string;
};

export type LibraryType = "personal" | "shared";
export type UserLibraryRole = "owner" | "editor" | "viewer";
export type ListType = "wishlist" | "pending" | "custom";
export type CopyFormat = "physical" | "digital";
export type CopyStatus = "available" | "loaned" | "reserved";
export type ReadingStatus = "pending" | "reading" | "finished";

export type User = {
  id: number;
  name: string;
  email: string;
};

export type Library = {
  id: number;
  name: string;
  type: LibraryType;
  created_at: string;
  role: UserLibraryRole;
  is_archived: boolean;
  archived_at: string | null;
  member_count: number;
  copy_count: number;
};

export type LibraryMember = {
  user_id: number;
  name: string;
  email: string;
  role: UserLibraryRole;
};

export type UserList = {
  id: number;
  user_id: number;
  name: string;
  type: ListType;
  created_at: string;
  updated_at: string;
  book_count: number;
};

export type ListBookSummary = {
  book_id: number;
  title: string;
  authors: string[];
  genres: string[];
  cover_url: string | null;
  publication_year: number | null;
  isbn: string | null;
  added_at: string;
};

export type Book = {
  id: number;
  book_id: number;
  library_id: number;
  title: string;
  isbn: string | null;
  publication_year: number | null;
  description: string | null;
  cover_url: string | null;
  publisher: string | null;
  authors: string[];
  genres: string[];
  format: CopyFormat;
  physical_location: string | null;
  digital_location: string | null;
  status: CopyStatus;
  reading_status: ReadingStatus;
  user_rating: number | null;
};

export type CopyDetail = {
  id: number;
  book_id: number;
  library_id: number;
  title: string;
  isbn: string | null;
  publication_year: number | null;
  description: string | null;
  cover_url: string | null;
  publisher: string | null;
  authors: string[];
  genres: string[];
  format: CopyFormat;
  physical_location: string | null;
  digital_location: string | null;
  status: CopyStatus;
};

export type BookMetadata = {
  id: number;
  title: string;
  isbn: string | null;
  publication_year: number | null;
  description: string | null;
  cover_url: string | null;
  publisher: string | null;
  authors: string[];
  genres: string[];
};

export type UserCopyData = {
  copy_id: number;
  reading_status: ReadingStatus;
  rating: number | null;
  start_date: string | null;
  end_date: string | null;
  personal_notes: string | null;
};

export type ExternalBookLookup = {
  title: string;
  authors: string[];
  publication_year: number | null;
  isbn: string | null;
  genres: string[];
  cover_url: string | null;
  publisher_name: string | null;
};

export type BookCreatePayload = {
  library_id: number;
  title: string;
  isbn?: string | null;
  publication_year?: number | null;
  description?: string | null;
  cover_url?: string | null;
  publisher_name?: string | null;
  authors: string[];
  genres: string[];
  format?: CopyFormat;
  physical_location?: string | null;
  digital_location?: string | null;
  status?: CopyStatus;
  reading_status: ReadingStatus;
  user_rating?: number | null;
};

export type BookMetadataUpdatePayload = {
  title?: string;
  isbn?: string | null;
  publication_year?: number | null;
  cover_url?: string | null;
  authors?: string[];
  genres?: string[];
  description?: string | null;
  publisher_name?: string | null;
};

export type CopyUpdatePayload = {
  format?: CopyFormat;
  physical_location?: string | null;
  digital_location?: string | null;
  status?: CopyStatus;
};

export type UserCopyUpdatePayload = {
  reading_status?: ReadingStatus;
  rating?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  personal_notes?: string | null;
};

export type BooksQueryParams = {
  libraryId?: number;
  q?: string;
  genre?: string;
  readingStatus?: ReadingStatus;
  minRating?: number;
};

export type LibraryCreatePayload = {
  name: string;
  type: LibraryType;
};

export type LibraryUpdatePayload = {
  name: string;
};

export type LibraryMemberCreatePayload = {
  email: string;
  role: Exclude<UserLibraryRole, "owner">;
};

export type LibraryMemberUpdatePayload = {
  role: Exclude<UserLibraryRole, "owner">;
};

export type ListCreatePayload = {
  name: string;
  type: ListType;
};

export type ListUpdatePayload = ListCreatePayload;

export type ListBookCreatePayload = {
  book_id: number;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  name: string;
  email: string;
  password: string;
};

export type AuthResponse = {
  access_token: string;
  token_type: "bearer";
  user: User;
};

type ApiFetchOptions = {
  token?: string | null;
};

export class ApiError extends Error {
  status: number;
  detail: unknown;

  constructor(message: string, status: number, detail: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function extractErrorMessage(detail: unknown, fallback: string): string {
  if (typeof detail === "string" && detail) {
    return detail;
  }

  if (
    detail &&
    typeof detail === "object" &&
    "detail" in detail &&
    typeof detail.detail === "string"
  ) {
    return detail.detail;
  }

  return fallback;
}

function buildQueryString(params: Record<string, string | number | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === "") {
      return;
    }

    searchParams.set(key, String(value));
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
  options?: ApiFetchOptions,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(options?.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const responseBody = contentType.includes("application/json")
    ? ((await response.json()) as unknown)
    : await response.text();

  if (!response.ok) {
    throw new ApiError(
      extractErrorMessage(
        responseBody,
        `Request failed with status ${response.status}`,
      ),
      response.status,
      responseBody,
    );
  }

  return responseBody as T;
}

export function fetchHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/health");
}

export function loginRequest(payload: LoginPayload): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function registerRequest(payload: RegisterPayload): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchMe(token: string): Promise<User> {
  return apiFetch<User>("/auth/me", undefined, {
    token,
  });
}

export function fetchLibraries(
  token: string,
  params?: { includeArchived?: boolean },
): Promise<Library[]> {
  const queryString = buildQueryString({
    include_archived: params?.includeArchived ? "true" : undefined,
  });

  return apiFetch<Library[]>(`/libraries${queryString}`, undefined, {
    token,
  });
}

export function createLibraryRequest(
  token: string,
  payload: LibraryCreatePayload,
): Promise<Library> {
  return apiFetch<Library>(
    "/libraries",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { token },
  );
}

export function updateLibraryRequest(
  token: string,
  libraryId: number,
  payload: LibraryUpdatePayload,
): Promise<Library> {
  return apiFetch<Library>(
    `/libraries/${libraryId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    { token },
  );
}

export function fetchLibraryMembers(token: string, libraryId: number): Promise<LibraryMember[]> {
  return apiFetch<LibraryMember[]>(`/libraries/${libraryId}/members`, undefined, {
    token,
  });
}

export function addLibraryMemberRequest(
  token: string,
  libraryId: number,
  payload: LibraryMemberCreatePayload,
): Promise<LibraryMember> {
  return apiFetch<LibraryMember>(
    `/libraries/${libraryId}/members`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { token },
  );
}

export function updateLibraryMemberRequest(
  token: string,
  libraryId: number,
  memberUserId: number,
  payload: LibraryMemberUpdatePayload,
): Promise<LibraryMember> {
  return apiFetch<LibraryMember>(
    `/libraries/${libraryId}/members/${memberUserId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    { token },
  );
}

export function removeLibraryMemberRequest(
  token: string,
  libraryId: number,
  memberUserId: number,
): Promise<void> {
  return apiFetch<void>(
    `/libraries/${libraryId}/members/${memberUserId}`,
    {
      method: "DELETE",
    },
    { token },
  );
}

export function archiveLibraryRequest(token: string, libraryId: number): Promise<Library> {
  return apiFetch<Library>(
    `/libraries/${libraryId}/archive`,
    {
      method: "POST",
    },
    { token },
  );
}

export function restoreLibraryRequest(token: string, libraryId: number): Promise<Library> {
  return apiFetch<Library>(
    `/libraries/${libraryId}/restore`,
    {
      method: "POST",
    },
    { token },
  );
}

export function deleteLibraryRequest(token: string, libraryId: number): Promise<void> {
  return apiFetch<void>(
    `/libraries/${libraryId}`,
    {
      method: "DELETE",
    },
    { token },
  );
}

export function fetchLists(token: string): Promise<UserList[]> {
  return apiFetch<UserList[]>("/lists", undefined, {
    token,
  });
}

export function createListRequest(
  token: string,
  payload: ListCreatePayload,
): Promise<UserList> {
  return apiFetch<UserList>(
    "/lists",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { token },
  );
}

export function updateListRequest(
  token: string,
  listId: number,
  payload: ListUpdatePayload,
): Promise<UserList> {
  return apiFetch<UserList>(
    `/lists/${listId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    { token },
  );
}

export function deleteListRequest(token: string, listId: number): Promise<void> {
  return apiFetch<void>(
    `/lists/${listId}`,
    {
      method: "DELETE",
    },
    { token },
  );
}

export function fetchListBooks(
  token: string,
  listId: number,
): Promise<ListBookSummary[]> {
  return apiFetch<ListBookSummary[]>(`/lists/${listId}/books`, undefined, {
    token,
  });
}

export function addBookToListRequest(
  token: string,
  listId: number,
  payload: ListBookCreatePayload,
): Promise<void> {
  return apiFetch<void>(
    `/lists/${listId}/books`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    { token },
  );
}

export function removeBookFromListRequest(
  token: string,
  listId: number,
  bookId: number,
): Promise<void> {
  return apiFetch<void>(
    `/lists/${listId}/books/${bookId}`,
    {
      method: "DELETE",
    },
    { token },
  );
}

export function fetchGenres(token: string): Promise<string[]> {
  return apiFetch<string[]>("/genres", undefined, {
    token,
  });
}

export function fetchBooks(
  token: string,
  params: BooksQueryParams,
): Promise<Book[]> {
  const queryString = buildQueryString({
    library_id: params.libraryId,
    q: params.q?.trim() || undefined,
    genre: params.genre?.trim() || undefined,
    reading_status: params.readingStatus,
    min_rating: params.minRating,
  });

  return apiFetch<Book[]>(`/books${queryString}`, undefined, {
    token,
  });
}

export function createBookRequest(
  token: string,
  payload: BookCreatePayload,
): Promise<Book> {
  return apiFetch<Book>(
    "/books",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    {
      token,
    },
  );
}

export function fetchCopyById(token: string, copyId: number): Promise<CopyDetail> {
  return apiFetch<CopyDetail>(`/copies/${copyId}`, undefined, {
    token,
  });
}

export function updateCopyRequest(
  token: string,
  copyId: number,
  payload: CopyUpdatePayload,
): Promise<CopyDetail> {
  return apiFetch<CopyDetail>(
    `/copies/${copyId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    {
      token,
    },
  );
}

export function updateBookMetadataRequest(
  token: string,
  bookId: number,
  payload: BookMetadataUpdatePayload,
): Promise<BookMetadata> {
  return apiFetch<BookMetadata>(
    `/books/${bookId}/metadata`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    {
      token,
    },
  );
}

export function deleteCopyRequest(token: string, copyId: number): Promise<void> {
  return apiFetch<void>(
    `/copies/${copyId}`,
    {
      method: "DELETE",
    },
    {
      token,
    },
  );
}

export function fetchUserCopyData(token: string, copyId: number): Promise<UserCopyData> {
  return apiFetch<UserCopyData>(`/copies/${copyId}/user-data`, undefined, {
    token,
  });
}

export function updateUserCopyDataRequest(
  token: string,
  copyId: number,
  payload: UserCopyUpdatePayload,
): Promise<UserCopyData> {
  return apiFetch<UserCopyData>(
    `/copies/${copyId}/user-data`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    {
      token,
    },
  );
}

export function fetchOpenLibraryBook(
  token: string,
  params: { isbn?: string; q?: string },
): Promise<ExternalBookLookup> {
  const queryString = buildQueryString({
    isbn: params.isbn?.trim() || undefined,
    q: params.q?.trim() || undefined,
  });

  return apiFetch<ExternalBookLookup>(`/external/open-library${queryString}`, undefined, {
    token,
  });
}
