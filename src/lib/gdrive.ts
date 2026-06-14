// Google Drive client-side REST API integration library

export function gdriveLoadClient(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).google?.accounts?.oauth2) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      resolve(true);
    };
    script.onerror = () => {
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

export async function gdriveCreateFolder(
  folderName: string,
  parentId: string | null,
  accessToken: string
): Promise<{ id: string; name: string }> {
  const metadata: any = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
  };

  if (parentId) {
    metadata.parents = [parentId];
  }

  const response = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Erro ao criar pasta no Google Drive");
  }

  return await response.json();
}

export async function gdriveUploadFile(
  fileBlob: Blob,
  fileName: string,
  parentId: string,
  accessToken: string
): Promise<{ id: string; name: string; mimeType: string; webViewLink: string; createdTime: string }> {
  const metadata = {
    name: fileName,
    parents: [parentId],
  };

  const formData = new FormData();
  formData.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" })
  );
  formData.append("file", fileBlob);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink,createdTime",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Erro no upload do arquivo para o Google Drive");
  }

  return await response.json();
}

export interface GDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  iconLink?: string;
  createdTime: string;
}

export async function gdriveListFiles(folderId: string, accessToken: string): Promise<GDriveFile[]> {
  const q = `'${folderId}' in parents and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    q
  )}&fields=files(id,name,mimeType,webViewLink,iconLink,createdTime)&orderBy=name`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Erro ao listar arquivos do Google Drive");
  }

  const data = await response.json();
  return data.files || [];
}

export async function gdriveDeleteFile(fileId: string, accessToken: string): Promise<boolean> {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || "Erro ao deletar arquivo do Google Drive");
  }

  return true;
}
