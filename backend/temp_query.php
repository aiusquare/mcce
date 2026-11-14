<?php
\ = new PDO('mysql:host=localhost;dbname=maslaha', 'root', '');
\ = \->query('SELECT DISTINCT status FROM result_batches');
print_r(\->fetchAll(PDO::FETCH_ASSOC));
