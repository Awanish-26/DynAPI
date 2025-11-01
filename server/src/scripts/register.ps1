param (
    [Parameter(Mandatory=$true)]
    [string]$role,

    [Parameter(Mandatory=$true)]
    [string]$password
)

$body = @{
    role = $role
    password = $password
} | ConvertTo-Json

Write-Host "Attempting to register role '$role'..."

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/auth/register" -Method Post -Body $body -ContentType "application/json"
    Write-Host "Registration successful!"
    $response | ConvertTo-Json
} catch {
    Write-Host "An error occurred during registration."
    $errorResponse = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($errorResponse)
    $reader.BaseStream.Position = 0
    $errorBody = $reader.ReadToEnd()
    Write-Host "Error details: $errorBody"
}