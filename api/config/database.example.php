<?php
/**
 * PLANTILLA DE CONFIGURACIÓN
 * Copia este archivo como database.php y modifica los valores
 */

class Database {
    private $host = 'localhost';
    private $db_name = 'sistema_insumos';
    private $username = 'tu_usuario';
    private $password = 'tu_password';
    private $port = '5432';
    private $conn;

    public function getConnection() {
        $this->conn = null;

        try {
            $dsn = "pgsql:host={$this->host};port={$this->port};dbname={$this->db_name}";
            
            $this->conn = new PDO(
                $dsn,
                $this->username,
                $this->password,
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                    PDO::ATTR_STRINGIFY_FETCHES => false
                ]
            );

            $this->conn->exec("SET timezone = 'America/Mexico_City'");

        } catch(PDOException $e) {
            error_log("Error de conexión a base de datos: " . $e->getMessage());
            throw new Exception("Error de conexión a la base de datos");
        }

        return $this->conn;
    }

    public function closeConnection() {
        $this->conn = null;
    }

    public function isConnected() {
        try {
            return $this->conn !== null && $this->conn->query('SELECT 1');
        } catch (PDOException $e) {
            return false;
        }
    }
}