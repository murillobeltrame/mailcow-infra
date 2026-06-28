import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { ApiError, api } from "@/lib/api";
import { mailKeys } from "@/lib/query-keys";

export function useMailbox() {
  const queryClient = useQueryClient();
  const [activeFolder, setActiveFolder] = useState("INBOX");
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const foldersQuery = useQuery({
    queryKey: mailKeys.folders,
    queryFn: () => api.folders().then((r) => r.folders),
  });

  const messagesQuery = useQuery({
    queryKey: mailKeys.messages(activeFolder, searchQuery),
    queryFn: () => api.messages(activeFolder, 0, searchQuery || undefined).then((r) => r.messages),
    enabled: !!activeFolder,
  });

  const messageQuery = useQuery({
    queryKey: mailKeys.message(activeFolder, selectedUid ?? 0),
    queryFn: () => api.message(activeFolder, selectedUid!),
    enabled: selectedUid !== null,
    retry: 1,
  });

  const activeFolderName = useMemo(
    () => foldersQuery.data?.find((f) => f.path === activeFolder)?.name ?? "Caixa de entrada",
    [foldersQuery.data, activeFolder]
  );

  const selectFolder = useCallback((path: string) => {
    setActiveFolder(path);
    setSelectedUid(null);
  }, []);

  const submitSearch = useCallback(() => {
    setSearchQuery(searchInput.trim());
    setSelectedUid(null);
  }, [searchInput]);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: mailKeys.folders });
    queryClient.invalidateQueries({ queryKey: mailKeys.messages(activeFolder, searchQuery) });
    if (selectedUid !== null) {
      queryClient.invalidateQueries({ queryKey: mailKeys.message(activeFolder, selectedUid) });
    }
  }, [queryClient, activeFolder, searchQuery, selectedUid]);

  const deleteMutation = useMutation({
    mutationFn: (uid: number) => api.deleteMessages(activeFolder, [uid]),
    onSuccess: () => {
      toast.success("Mensagem excluída");
      setSelectedUid(null);
      queryClient.invalidateQueries({ queryKey: mailKeys.messages(activeFolder, searchQuery) });
      queryClient.invalidateQueries({ queryKey: mailKeys.folders });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : "Erro ao excluir");
    },
  });

  return {
    folders: foldersQuery.data ?? [],
    foldersLoading: foldersQuery.isLoading,
    messages: messagesQuery.data ?? [],
    messagesLoading: messagesQuery.isLoading,
    message: messageQuery.data ?? null,
    messageLoading: messageQuery.isPending,
    messageError: messageQuery.error,
    activeFolder,
    activeFolderName,
    selectedUid,
    searchInput,
    setSearchInput,
    selectFolder,
    setSelectedUid,
    submitSearch,
    refresh,
    deleteMessage: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
    foldersError: foldersQuery.error,
    messagesError: messagesQuery.error,
  };
}
