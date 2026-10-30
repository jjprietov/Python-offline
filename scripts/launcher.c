#define _WIN32_WINNT 0x0600
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <shellapi.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define RES_APP_ICON 1
#define RES_HTML_DATA 100
#define RES_ICO_DATA 101

static volatile int g_shutdown = 0;
static HANDLE g_hBrowserProcess = NULL;
static DWORD g_lastRequestTime = 0;

// Helper to check if file exists
static int FileExistsA(const char* path) {
    DWORD dwAttrib = GetFileAttributesA(path);
    return (dwAttrib != INVALID_FILE_ATTRIBUTES && !(dwAttrib & FILE_ATTRIBUTE_DIRECTORY));
}

// Find path to Microsoft Edge or Chrome
static int FindAppBrowser(char* outPath, size_t maxLen) {
    char temp[MAX_PATH];
    
    // Check Edge 64-bit / 32-bit Program Files
    const char* programFilesX86 = getenv("ProgramFiles(x86)");
    const char* programFiles = getenv("ProgramFiles");
    const char* localAppData = getenv("LOCALAPPDATA");

    if (programFilesX86) {
        snprintf(temp, sizeof(temp), "%s\\Microsoft\\Edge\\Application\\msedge.exe", programFilesX86);
        if (FileExistsA(temp)) {
            strncpy(outPath, temp, maxLen);
            return 1;
        }
    }
    if (programFiles) {
        snprintf(temp, sizeof(temp), "%s\\Microsoft\\Edge\\Application\\msedge.exe", programFiles);
        if (FileExistsA(temp)) {
            strncpy(outPath, temp, maxLen);
            return 1;
        }
    }
    if (localAppData) {
        snprintf(temp, sizeof(temp), "%s\\Microsoft\\Edge\\Application\\msedge.exe", localAppData);
        if (FileExistsA(temp)) {
            strncpy(outPath, temp, maxLen);
            return 1;
        }
    }

    // Check Chrome
    if (programFiles) {
        snprintf(temp, sizeof(temp), "%s\\Google\\Chrome\\Application\\chrome.exe", programFiles);
        if (FileExistsA(temp)) {
            strncpy(outPath, temp, maxLen);
            return 1;
        }
    }
    if (programFilesX86) {
        snprintf(temp, sizeof(temp), "%s\\Google\\Chrome\\Application\\chrome.exe", programFilesX86);
        if (FileExistsA(temp)) {
            strncpy(outPath, temp, maxLen);
            return 1;
        }
    }
    if (localAppData) {
        snprintf(temp, sizeof(temp), "%s\\Google\\Chrome\\Application\\chrome.exe", localAppData);
        if (FileExistsA(temp)) {
            strncpy(outPath, temp, maxLen);
            return 1;
        }
    }

    return 0;
}

// Send all data reliably
static int SendAll(SOCKET sock, const char* buffer, int len) {
    int total = 0;
    while (total < len) {
        int n = send(sock, buffer + total, len - total, 0);
        if (n <= 0) return 0;
        total += n;
    }
    return 1;
}

int WINAPI WinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, LPSTR lpCmdLine, int nCmdShow) {
    // 1. Initialize Winsock
    WSADATA wsa;
    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
        MessageBoxA(NULL, "No se pudo iniciar el subsistema de red local.", "Error", MB_ICONERROR);
        return 1;
    }

    // 2. Locate embedded HTML resource
    HRSRC hResHtml = FindResourceA(hInstance, MAKEINTRESOURCEA(RES_HTML_DATA), "RCDATA");
    if (!hResHtml) {
        MessageBoxA(NULL, "No se encontro el recurso de la aplicacion.", "Error", MB_ICONERROR);
        WSACleanup();
        return 1;
    }
    HGLOBAL hGlobHtml = LoadResource(hInstance, hResHtml);
    DWORD htmlSize = SizeofResource(hInstance, hResHtml);
    const char* htmlData = (const char*)LockResource(hGlobHtml);

    // Locate embedded ICO resource if present
    HRSRC hResIco = FindResourceA(hInstance, MAKEINTRESOURCEA(RES_ICO_DATA), "RCDATA");
    DWORD icoSize = 0;
    const char* icoData = NULL;
    if (hResIco) {
        HGLOBAL hGlobIco = LoadResource(hInstance, hResIco);
        icoSize = SizeofResource(hInstance, hResIco);
        icoData = (const char*)LockResource(hGlobIco);
    }

    // 3. Create listening socket on 127.0.0.1 with ephemeral port
    SOCKET serverSock = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (serverSock == INVALID_SOCKET) {
        WSACleanup();
        return 1;
    }

    // Reuse address
    int opt = 1;
    setsockopt(serverSock, SOL_SOCKET, SO_REUSEADDR, (const char*)&opt, sizeof(opt));

    struct sockaddr_in serverAddr;
    memset(&serverAddr, 0, sizeof(serverAddr));
    serverAddr.sin_family = AF_INET;
    serverAddr.sin_addr.s_addr = inet_addr("127.0.0.1");
    serverAddr.sin_port = 0; // OS chooses random available port

    if (bind(serverSock, (struct sockaddr*)&serverAddr, sizeof(serverAddr)) == SOCKET_ERROR) {
        closesocket(serverSock);
        WSACleanup();
        return 1;
    }

    int addrLen = sizeof(serverAddr);
    if (getsockname(serverSock, (struct sockaddr*)&serverAddr, &addrLen) == SOCKET_ERROR) {
        closesocket(serverSock);
        WSACleanup();
        return 1;
    }
    int port = ntohs(serverAddr.sin_port);

    if (listen(serverSock, SOMAXCONN) == SOCKET_ERROR) {
        closesocket(serverSock);
        WSACleanup();
        return 1;
    }

    // Set non-blocking on listening socket
    u_long nonblock = 1;
    ioctlsocket(serverSock, FIONBIO, &nonblock);

    // 4. Construct URL
    char url[128];
    snprintf(url, sizeof(url), "http://127.0.0.1:%d/", port);

    // 5. Try to launch Microsoft Edge or Chrome in app-window mode
    char browserPath[MAX_PATH];
    if (FindAppBrowser(browserPath, sizeof(browserPath))) {
        char tempDir[MAX_PATH];
        GetTempPathA(sizeof(tempDir), tempDir);

        char cmd[1024];
        snprintf(cmd, sizeof(cmd), "\"%s\" --app=\"%s\" --user-data-dir=\"%sInterpretePython3Profile_%d\"",
                 browserPath, url, tempDir, port);

        STARTUPINFOA si;
        PROCESS_INFORMATION pi;
        memset(&si, 0, sizeof(si));
        si.cb = sizeof(si);
        memset(&pi, 0, sizeof(pi));

        if (CreateProcessA(NULL, cmd, NULL, NULL, FALSE, 0, NULL, NULL, &si, &pi)) {
            g_hBrowserProcess = pi.hProcess;
            CloseHandle(pi.hThread);
        } else {
            ShellExecuteA(NULL, "open", url, NULL, NULL, SW_SHOWNORMAL);
        }
    } else {
        ShellExecuteA(NULL, "open", url, NULL, NULL, SW_SHOWNORMAL);
    }

    g_lastRequestTime = GetTickCount();

    // 6. Main HTTP request loop
    while (!g_shutdown) {
        // If we have a browser process handle, check if user closed the window
        if (g_hBrowserProcess != NULL) {
            DWORD dwWait = WaitForSingleObject(g_hBrowserProcess, 0);
            if (dwWait == WAIT_OBJECT_0) {
                // User closed Edge/Chrome app window!
                g_shutdown = 1;
                break;
            }
        } else {
            // No process handle (ShellExecute): auto shutdown if idle for 20 minutes
            if (GetTickCount() - g_lastRequestTime > 20 * 60 * 1000) {
                g_shutdown = 1;
                break;
            }
        }

        // Wait for incoming socket activity with 500ms timeout
        fd_set readFds;
        FD_ZERO(&readFds);
        FD_SET(serverSock, &readFds);

        struct timeval tv;
        tv.tv_sec = 0;
        tv.tv_usec = 500000; // 500ms

        int sel = select(0, &readFds, NULL, NULL, &tv);
        if (sel <= 0) {
            continue;
        }

        struct sockaddr_in clientAddr;
        int clientLen = sizeof(clientAddr);
        SOCKET clientSock = accept(serverSock, (struct sockaddr*)&clientAddr, &clientLen);
        if (clientSock == INVALID_SOCKET) {
            continue;
        }

        // Set 2 second timeout on client socket
        DWORD timeoutMs = 2000;
        setsockopt(clientSock, SOL_SOCKET, SO_RCVTIMEO, (const char*)&timeoutMs, sizeof(timeoutMs));
        setsockopt(clientSock, SOL_SOCKET, SO_SNDTIMEO, (const char*)&timeoutMs, sizeof(timeoutMs));

        char reqBuf[2048];
        int bytesRead = recv(clientSock, reqBuf, sizeof(reqBuf) - 1, 0);
        if (bytesRead > 0) {
            reqBuf[bytesRead] = '\0';
            g_lastRequestTime = GetTickCount();

            // Check requested path
            if (strstr(reqBuf, "GET /quit") || strstr(reqBuf, "POST /quit")) {
                const char* resp = "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok";
                SendAll(clientSock, resp, (int)strlen(resp));
                closesocket(clientSock);
                g_shutdown = 1;
                break;
            } else if (strstr(reqBuf, "GET /ping") || strstr(reqBuf, "POST /ping")) {
                const char* resp = "HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok";
                SendAll(clientSock, resp, (int)strlen(resp));
            } else if (strstr(reqBuf, "GET /favicon.ico") && icoData && icoSize > 0) {
                char header[256];
                int hlen = snprintf(header, sizeof(header),
                    "HTTP/1.1 200 OK\r\nContent-Type: image/x-icon\r\nContent-Length: %lu\r\nCache-Control: max-age=86400\r\nConnection: close\r\n\r\n",
                    icoSize);
                SendAll(clientSock, header, hlen);
                SendAll(clientSock, icoData, (int)icoSize);
            } else {
                // Serve main HTML
                char header[512];
                int hlen = snprintf(header, sizeof(header),
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: %lu\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n",
                    htmlSize);
                SendAll(clientSock, header, hlen);
                SendAll(clientSock, htmlData, (int)htmlSize);
            }
        }
        closesocket(clientSock);
    }

    if (g_hBrowserProcess != NULL) {
        CloseHandle(g_hBrowserProcess);
    }
    closesocket(serverSock);
    WSACleanup();
    return 0;
}
