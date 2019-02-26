Import-Module MSOnline

$tenantID = "<Id of the tenant where the bot will be able to reset passwords>"

$appID = "<app id created to represent the bot and which will have admin rights>"

# Using the Windows Azure Active Directory Module for Windows PowerShell
#
# Connect to the tenant to modify
Connect-MsolService

$applicationId = $appID
$sp = Get-MsolServicePrincipal -AppPrincipalId $applicationId -TenantId $tenantID
Add-MsolRoleMember -RoleObjectId fe930be7-5e62-47db-91af-98c3a49a38b1 -RoleMemberObjectId $sp.ObjectId -RoleMemberType servicePrincipal -TenantId $tenantID