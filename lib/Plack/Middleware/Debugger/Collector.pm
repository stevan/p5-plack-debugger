package Plack::Middleware::Debugger::Collector;

use strict;
use warnings;

use parent 'Plack::Middleware';

use Plack::Util::Accessor (
    'debugger', # a reference to the Plack::Debugger
);

sub call {
    my ($self, $env) = @_;
    $self->debugger->run_before_phase( $env );
    $self->response_cb(
        $self->app->( $env ), 
        sub { 
            $self->debugger->run_after_phase( $env, @_ );
        }
    );
}

1;

__END__